from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.audit import AuditLog
from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    Message,
    RetrievedChunk,
)
from app.models.document import Chunk, Document
from app.models.user import User
from app.models.workspace import Workspace


TRACE_DEFAULT_PAGE_SIZE = 20
TRACE_MAX_PAGE_SIZE = 200
PREVIEW_CHARS = 300
QUESTION_PREVIEW_CHARS = 180
ANSWER_PREVIEW_CHARS = 240
SECRET_KEY_MARKERS = (
    "api_key",
    "apikey",
    "authorization",
    "credential",
    "password",
    "secret",
    "token",
)


async def list_rag_traces(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = TRACE_DEFAULT_PAGE_SIZE,
    workspace_id: UUID | None = None,
    user_id: UUID | None = None,
    retrieval_strategy: str | None = None,
    min_faithfulness: float | None = None,
    max_hallucination_score: float | None = None,
    has_citations: bool | None = None,
    corrected: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
) -> dict[str, object]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), TRACE_MAX_PAGE_SIZE)
    offset = (page - 1) * page_size
    statement = _trace_list_statement(
        workspace_id=workspace_id,
        user_id=user_id,
        retrieval_strategy=retrieval_strategy,
        min_faithfulness=min_faithfulness,
        max_hallucination_score=max_hallucination_score,
        has_citations=has_citations,
        corrected=corrected,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    count_statement = select(func.count()).select_from(
        statement.order_by(None).limit(None).offset(None).subquery()
    )
    total = int((await db.scalar(count_statement)) or 0)

    rows = await db.execute(statement.offset(offset).limit(page_size))
    items = [_trace_list_row_to_dict(row) for row in rows.all()]
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


async def get_trace_detail(
    db: AsyncSession,
    message_id: UUID,
    *,
    actor: User,
    include_content: bool = False,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    _ensure_content_access(actor=actor, include_content=include_content)
    header = await _get_trace_header(db, message_id)
    agent_runs = await _get_agent_runs(db, message_id)
    citations = await _get_citations(db, message_id, include_content=include_content)
    retrieved_chunks = _retrieved_chunks_from_agent_runs(
        agent_runs,
        include_content=include_content,
    )
    if not retrieved_chunks:
        retrieved_chunks = [
            {
                "rank": item["rank"],
                "filename": item["filename"],
                "chunk_index": item["chunk_index"],
                "score": item["score"],
                "content_preview": item["content_preview"],
                "content": item.get("content"),
                "source_scores": {},
                "document_id": item["document_id"],
                "chunk_id": item["chunk_id"],
            }
            for item in citations
        ]

    evaluation = await _get_evaluation_details(db, message_id, agent_runs)
    corrector_decision = _corrector_decision(agent_runs, header["assistant_answer"])
    await _audit_trace_access(
        db,
        actor=actor,
        message_id=message_id,
        include_content=include_content,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    sanitized_agent_runs = [_agent_run_to_dict(run, include_content=include_content) for run in agent_runs]
    return {
        "message_id": message_id,
        "conversation_id": header["conversation_id"],
        "workspace": {
            "id": header["workspace_id"],
            "name": header["workspace_name"],
        },
        "user": {
            "id": header["user_id"],
            "email": header["user_email"],
            "full_name": header["user_full_name"],
        },
        "question": header["user_question"],
        "answer": header["assistant_answer"],
        "retrieval_strategy": _retrieval_strategy(agent_runs, citations),
        "citations": citations,
        "retrieved_chunks": retrieved_chunks,
        "evaluation": evaluation,
        "agent_runs": sanitized_agent_runs,
        "latency_summary": _latency_summary(agent_runs),
        "corrector_decision": corrector_decision,
    }


async def get_retrieval_details(
    db: AsyncSession,
    message_id: UUID,
    *,
    actor: User,
    include_content: bool = False,
) -> dict[str, object]:
    _ensure_content_access(actor=actor, include_content=include_content)
    header = await _get_trace_header(db, message_id)
    agent_runs = await _get_agent_runs(db, message_id)
    retrieved_chunks = _retrieved_chunks_from_agent_runs(
        agent_runs,
        include_content=include_content,
    )
    if not retrieved_chunks:
        citations = await _get_citations(db, message_id, include_content=include_content)
        retrieved_chunks = [
            {
                "rank": item["rank"],
                "filename": item["filename"],
                "chunk_index": item["chunk_index"],
                "score": item["score"],
                "content_preview": item["content_preview"],
                "content": item.get("content"),
                "source_scores": {},
                "document_id": item["document_id"],
                "chunk_id": item["chunk_id"],
            }
            for item in citations
        ]

    return {
        "message_id": message_id,
        "original_query": header["user_question"],
        "rewritten_query": _rewritten_query(agent_runs),
        "retrieval_strategy": _retrieval_strategy(agent_runs, []),
        "chunks": retrieved_chunks,
    }


async def get_reranking_details(
    db: AsyncSession,
    message_id: UUID,
    *,
    actor: User,
    include_content: bool = False,
) -> dict[str, object]:
    _ensure_content_access(actor=actor, include_content=include_content)
    await _get_trace_header(db, message_id)
    agent_runs = await _get_agent_runs(db, message_id)
    used_chunk_ids = {str(item["chunk_id"]) for item in await _get_citations(db, message_id)}
    reranker_details_available = bool(_raw_chunks_from_agent_run(agent_runs, "reranker"))
    return {
        "message_id": message_id,
        "reranker_details_available": reranker_details_available,
        "items": _reranking_items(
            agent_runs,
            used_chunk_ids=used_chunk_ids,
            include_content=include_content,
        ),
    }


async def get_evaluation_details(
    db: AsyncSession,
    message_id: UUID,
) -> dict[str, object]:
    await _get_trace_header(db, message_id)
    agent_runs = await _get_agent_runs(db, message_id)
    return await _get_evaluation_details(db, message_id, agent_runs)


async def get_quality_summary(db: AsyncSession) -> dict[str, object]:
    rows = await db.execute(_trace_list_statement())
    traces = [_trace_list_row_to_dict(row) for row in rows.all()]

    total = len(traces)
    low_quality_count = sum(
        1
        for item in traces
        if item["faithfulness"] < 0.5 or item["relevance"] < 0.5
    )
    hallucination_risk_count = sum(
        1 for item in traces if item["hallucination_score"] > 0.6
    )
    no_context_count = sum(1 for item in traces if item["citation_count"] == 0)
    corrected_answers_count = sum(1 for item in traces if item["corrected"])

    return {
        "total_rag_queries": total,
        "average_faithfulness": _average(item["faithfulness"] for item in traces),
        "average_relevance": _average(item["relevance"] for item in traces),
        "average_context_precision": _average(
            item["context_precision"] for item in traces
        ),
        "average_hallucination_score": _average(
            item["hallucination_score"] for item in traces
        ),
        "low_quality_count": low_quality_count,
        "hallucination_risk_count": hallucination_risk_count,
        "no_context_count": no_context_count,
        "corrected_answers_count": corrected_answers_count,
        "average_latency_by_agent": await _average_latency_by_agent(db),
        "worst_messages_by_hallucination": [
            _worst_message(item)
            for item in sorted(
                traces,
                key=lambda trace: trace["hallucination_score"],
                reverse=True,
            )[:10]
        ],
        "worst_messages_by_relevance": [
            _worst_message(item)
            for item in sorted(traces, key=lambda trace: trace["relevance"])[:10]
        ],
    }


def _trace_list_statement(
    *,
    workspace_id: UUID | None = None,
    user_id: UUID | None = None,
    retrieval_strategy: str | None = None,
    min_faithfulness: float | None = None,
    max_hallucination_score: float | None = None,
    has_citations: bool | None = None,
    corrected: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
) -> Any:
    citation_agg = (
        select(
            RetrievedChunk.message_id.label("message_id"),
            func.count(RetrievedChunk.id).label("citation_count"),
            func.max(RetrievedChunk.retrieval_strategy).label("retrieval_strategy"),
        )
        .group_by(RetrievedChunk.message_id)
        .subquery()
    )
    latency_agg = (
        select(
            AgentRun.message_id.label("message_id"),
            func.coalesce(func.sum(AgentRun.latency_ms), 0).label("total_latency_ms"),
        )
        .group_by(AgentRun.message_id)
        .subquery()
    )
    corrector_run = aliased(AgentRun)
    retrieval_run = aliased(AgentRun)
    question_expr = _question_subquery()
    retrieval_strategy_expr = func.coalesce(
        citation_agg.c.retrieval_strategy,
        retrieval_run.input["retrieval_strategy"].as_string(),
        retrieval_run.output["retrieval_strategy"].as_string(),
    )
    corrected_expr = func.coalesce(
        corrector_run.output["correction_applied"].as_boolean(),
        False,
    )

    statement = (
        select(
            Message.id.label("message_id"),
            Message.conversation_id,
            Conversation.workspace_id,
            Workspace.name.label("workspace_name"),
            User.id.label("user_id"),
            User.email.label("user_email"),
            question_expr.label("question"),
            Message.content.label("answer"),
            retrieval_strategy_expr.label("retrieval_strategy"),
            func.coalesce(citation_agg.c.citation_count, 0).label("citation_count"),
            Evaluation.faithfulness,
            Evaluation.relevance,
            Evaluation.context_precision,
            Evaluation.hallucination_score,
            corrected_expr.label("corrected"),
            Message.created_at,
            func.coalesce(latency_agg.c.total_latency_ms, 0).label("total_latency_ms"),
        )
        .join(Conversation, Conversation.id == Message.conversation_id)
        .join(Workspace, Workspace.id == Conversation.workspace_id)
        .outerjoin(User, User.id == Conversation.user_id)
        .outerjoin(Evaluation, Evaluation.message_id == Message.id)
        .outerjoin(citation_agg, citation_agg.c.message_id == Message.id)
        .outerjoin(latency_agg, latency_agg.c.message_id == Message.id)
        .outerjoin(
            corrector_run,
            (corrector_run.message_id == Message.id)
            & (corrector_run.agent_type == "corrector"),
        )
        .outerjoin(
            retrieval_run,
            (retrieval_run.message_id == Message.id)
            & (retrieval_run.agent_type == "retrieval"),
        )
        .where(
            Message.role == "assistant",
            select(AgentRun.id).where(AgentRun.message_id == Message.id).exists(),
        )
        .order_by(desc(Message.created_at))
    )

    if workspace_id is not None:
        statement = statement.where(Conversation.workspace_id == workspace_id)
    if user_id is not None:
        statement = statement.where(Conversation.user_id == user_id)
    if retrieval_strategy:
        statement = statement.where(retrieval_strategy_expr == retrieval_strategy)
    if min_faithfulness is not None:
        statement = statement.where(Evaluation.faithfulness >= min_faithfulness)
    if max_hallucination_score is not None:
        statement = statement.where(
            Evaluation.hallucination_score <= max_hallucination_score
        )
    if has_citations is True:
        statement = statement.where(func.coalesce(citation_agg.c.citation_count, 0) > 0)
    elif has_citations is False:
        statement = statement.where(func.coalesce(citation_agg.c.citation_count, 0) == 0)
    if corrected is not None:
        statement = statement.where(corrected_expr == corrected)
    if date_from is not None:
        statement = statement.where(Message.created_at >= date_from)
    if date_to is not None:
        statement = statement.where(Message.created_at <= date_to)
    if search:
        term = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(func.coalesce(question_expr, "")).like(term)
            | func.lower(func.coalesce(Message.content, "")).like(term)
        )

    return statement


def _question_subquery() -> Any:
    user_message = aliased(Message)
    return (
        select(user_message.content)
        .where(
            user_message.conversation_id == Message.conversation_id,
            user_message.role == "user",
            user_message.created_at <= Message.created_at,
        )
        .order_by(desc(user_message.created_at))
        .limit(1)
        .correlate(Message)
        .scalar_subquery()
    )


def _trace_list_row_to_dict(row: Any) -> dict[str, object]:
    return {
        "message_id": row.message_id,
        "conversation_id": row.conversation_id,
        "workspace_id": row.workspace_id,
        "workspace_name": row.workspace_name,
        "user_id": row.user_id,
        "user_email": row.user_email,
        "question_preview": _preview(row.question or "", max_chars=QUESTION_PREVIEW_CHARS),
        "answer_preview": _preview(row.answer or "", max_chars=ANSWER_PREVIEW_CHARS),
        "retrieval_strategy": row.retrieval_strategy,
        "citation_count": int(row.citation_count or 0),
        "faithfulness": _float_or_zero(row.faithfulness),
        "relevance": _float_or_zero(row.relevance),
        "context_precision": _float_or_zero(row.context_precision),
        "hallucination_score": _float_or_zero(row.hallucination_score),
        "corrected": bool(row.corrected),
        "created_at": row.created_at,
        "total_latency_ms": int(row.total_latency_ms or 0),
    }


async def _get_trace_header(db: AsyncSession, message_id: UUID) -> dict[str, object]:
    question_expr = _question_subquery()
    row = (
        await db.execute(
            select(
                Message.id,
                Message.conversation_id,
                Message.content.label("assistant_answer"),
                Conversation.workspace_id,
                Conversation.user_id,
                Workspace.name.label("workspace_name"),
                User.email.label("user_email"),
                User.full_name.label("user_full_name"),
                question_expr.label("user_question"),
            )
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(Workspace, Workspace.id == Conversation.workspace_id)
            .outerjoin(User, User.id == Conversation.user_id)
            .where(Message.id == message_id, Message.role == "assistant")
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RAG trace not found")
    return {
        "message_id": row.id,
        "conversation_id": row.conversation_id,
        "assistant_answer": row.assistant_answer,
        "workspace_id": row.workspace_id,
        "workspace_name": row.workspace_name,
        "user_id": row.user_id,
        "user_email": row.user_email,
        "user_full_name": row.user_full_name,
        "user_question": row.user_question or "",
    }


async def _get_agent_runs(db: AsyncSession, message_id: UUID) -> list[AgentRun]:
    result = await db.scalars(
        select(AgentRun)
        .where(AgentRun.message_id == message_id)
        .order_by(AgentRun.created_at, AgentRun.id)
    )
    return list(result.all())


async def _get_citations(
    db: AsyncSession,
    message_id: UUID,
    *,
    include_content: bool = False,
) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            RetrievedChunk.rank,
            RetrievedChunk.score,
            Chunk.id.label("chunk_id"),
            Chunk.chunk_index,
            Chunk.content,
            Document.id.label("document_id"),
            Document.filename,
        )
        .join(Chunk, Chunk.id == RetrievedChunk.chunk_id)
        .join(Document, Document.id == Chunk.document_id)
        .where(RetrievedChunk.message_id == message_id)
        .order_by(RetrievedChunk.rank)
    )
    citations = []
    for row in rows.all():
        content = row.content or ""
        citations.append(
            {
                "rank": int(row.rank or 0),
                "filename": row.filename,
                "chunk_index": row.chunk_index,
                "score": _float_or_zero(row.score),
                "content_preview": _preview(content),
                "content": content if include_content else None,
                "document_id": row.document_id,
                "chunk_id": row.chunk_id,
            }
        )
    return citations


async def _get_evaluation_details(
    db: AsyncSession,
    message_id: UUID,
    agent_runs: list[AgentRun],
) -> dict[str, object]:
    evaluation = await db.scalar(
        select(Evaluation)
        .where(Evaluation.message_id == message_id)
        .order_by(desc(Evaluation.created_at))
    )
    corrector = _latest_agent_run(agent_runs, "corrector")
    corrector_output = corrector.output if corrector and isinstance(corrector.output, dict) else {}

    if evaluation is None:
        return {
            "faithfulness": 0.0,
            "relevance": 0.0,
            "context_precision": 0.0,
            "hallucination_score": 0.0,
            "explanation": "No evaluation row was recorded.",
            "evaluation_method": "unknown",
            "corrected": bool(corrector_output.get("correction_applied")),
            "correction_reason": _string_or_none(corrector_output.get("reason")),
        }

    return {
        "faithfulness": _float_or_zero(evaluation.faithfulness),
        "relevance": _float_or_zero(evaluation.relevance),
        "context_precision": _float_or_zero(evaluation.context_precision),
        "hallucination_score": _float_or_zero(evaluation.hallucination_score),
        "explanation": evaluation.explanation,
        "evaluation_method": _evaluation_method(evaluation.explanation, agent_runs),
        "corrected": bool(corrector_output.get("correction_applied")),
        "correction_reason": _string_or_none(corrector_output.get("reason")),
    }


def _retrieved_chunks_from_agent_runs(
    agent_runs: list[AgentRun],
    *,
    include_content: bool,
) -> list[dict[str, object]]:
    retrieval_run = _latest_agent_run(agent_runs, "retrieval")
    retrieval_output = (
        retrieval_run.output
        if retrieval_run is not None and isinstance(retrieval_run.output, dict)
        else {}
    )
    chunks = retrieval_output.get("chunks")
    if not isinstance(chunks, list):
        return []

    retrieved_chunks: list[dict[str, object]] = []
    for index, raw_chunk in enumerate(chunks, start=1):
        if not isinstance(raw_chunk, dict):
            continue
        content = str(raw_chunk.get("content") or "")
        retrieved_chunks.append(
            {
                "rank": index,
                "filename": str(raw_chunk.get("filename") or "unknown"),
                "chunk_index": _int_or_zero(raw_chunk.get("chunk_index")),
                "score": _float_or_zero(raw_chunk.get("score")),
                "content_preview": _preview(content),
                "content": content if include_content else None,
                "source_scores": _source_scores(raw_chunk),
                "document_id": _uuid_or_none(raw_chunk.get("document_id")),
                "chunk_id": _uuid_or_none(raw_chunk.get("chunk_id")),
            }
        )
    return retrieved_chunks


def _reranking_items(
    agent_runs: list[AgentRun],
    *,
    used_chunk_ids: set[str],
    include_content: bool,
) -> list[dict[str, object]]:
    retrieval_chunks = _raw_chunks_from_agent_run(agent_runs, "retrieval")
    reranked_chunks = _raw_chunks_from_agent_run(agent_runs, "reranker")
    if not reranked_chunks:
        reranked_chunks = retrieval_chunks

    original_by_chunk_id = {
        str(chunk.get("chunk_id")): (index, chunk)
        for index, chunk in enumerate(retrieval_chunks, start=1)
        if isinstance(chunk, dict)
    }

    items: list[dict[str, object]] = []
    for final_rank, raw_chunk in enumerate(reranked_chunks, start=1):
        if not isinstance(raw_chunk, dict):
            continue
        chunk_id = str(raw_chunk.get("chunk_id") or "")
        original_rank, original_chunk = original_by_chunk_id.get(chunk_id, (None, {}))
        metadata = raw_chunk.get("metadata") if isinstance(raw_chunk.get("metadata"), dict) else {}
        features = (
            metadata.get("rerank_features")
            if isinstance(metadata.get("rerank_features"), dict)
            else {}
        )
        content = str(raw_chunk.get("content") or original_chunk.get("content") or "")
        items.append(
            {
                "filename": str(
                    raw_chunk.get("filename") or original_chunk.get("filename") or "unknown"
                ),
                "chunk_id": _uuid_or_none(
                    raw_chunk.get("chunk_id") or original_chunk.get("chunk_id")
                ),
                "original_rank": original_rank,
                "final_rank": final_rank,
                "original_score": _float_or_zero(original_chunk.get("score")),
                "rerank_score": _optional_float(raw_chunk.get("rerank_score")),
                "exact_matches": _optional_int(features.get("exact_matches")),
                "overlap": _optional_float(features.get("overlap")),
                "used_in_final_citations": chunk_id in used_chunk_ids,
                "content_preview": _preview(content),
                "content": content if include_content else None,
                "document_id": _uuid_or_none(
                    raw_chunk.get("document_id") or original_chunk.get("document_id")
                ),
            }
        )
    return items


def _raw_chunks_from_agent_run(agent_runs: list[AgentRun], agent_type: str) -> list[dict[str, Any]]:
    agent_run = _latest_agent_run(agent_runs, agent_type)
    output = agent_run.output if agent_run and isinstance(agent_run.output, dict) else {}
    chunks = output.get("chunks")
    if not isinstance(chunks, list):
        return []
    return [chunk for chunk in chunks if isinstance(chunk, dict)]


def _rewritten_query(agent_runs: list[AgentRun]) -> str | None:
    rewrite_run = _latest_agent_run(agent_runs, "query_rewriter")
    if rewrite_run and isinstance(rewrite_run.output, dict):
        query = rewrite_run.output.get("query")
        if isinstance(query, str):
            return query

    retrieval_run = _latest_agent_run(agent_runs, "retrieval")
    if retrieval_run and isinstance(retrieval_run.input, dict):
        query = retrieval_run.input.get("query")
        if isinstance(query, str):
            return query
    return None


def _retrieval_strategy(
    agent_runs: list[AgentRun],
    citations: list[dict[str, object]],
) -> str | None:
    retrieval_run = _latest_agent_run(agent_runs, "retrieval")
    if retrieval_run:
        if isinstance(retrieval_run.input, dict) and isinstance(
            retrieval_run.input.get("retrieval_strategy"),
            str,
        ):
            return str(retrieval_run.input["retrieval_strategy"])
        if isinstance(retrieval_run.output, dict) and isinstance(
            retrieval_run.output.get("retrieval_strategy"),
            str,
        ):
            return str(retrieval_run.output["retrieval_strategy"])
    if citations:
        return "stored_citations"
    return None


def _latest_agent_run(agent_runs: list[AgentRun], agent_type: str) -> AgentRun | None:
    for run in reversed(agent_runs):
        if run.agent_type == agent_type:
            return run
    return None


def _agent_run_to_dict(run: AgentRun, *, include_content: bool) -> dict[str, object]:
    output = _sanitize_payload(run.output, include_content=include_content)
    error = None
    if isinstance(run.output, dict) and isinstance(run.output.get("error"), str):
        error = run.output["error"]
    return {
        "id": run.id,
        "agent_type": run.agent_type,
        "status": run.status,
        "latency_ms": run.latency_ms,
        "input_preview": _sanitize_payload(run.input, include_content=include_content),
        "output_preview": output,
        "error": error,
        "created_at": run.created_at,
    }


def _corrector_decision(agent_runs: list[AgentRun], assistant_answer: str) -> dict[str, object]:
    generator_run = _latest_agent_run(agent_runs, "generator")
    corrector_run = _latest_agent_run(agent_runs, "corrector")
    generator_output = (
        generator_run.output
        if generator_run is not None and isinstance(generator_run.output, dict)
        else {}
    )
    corrector_output = (
        corrector_run.output
        if corrector_run is not None and isinstance(corrector_run.output, dict)
        else {}
    )
    generated_answer = _string_or_none(generator_output.get("answer"))
    final_answer = _string_or_none(corrector_output.get("answer")) or assistant_answer
    correction_applied = bool(corrector_output.get("correction_applied"))
    return {
        "corrected": correction_applied or (generated_answer is not None and generated_answer != final_answer),
        "correction_applied": correction_applied,
        "reason": _string_or_none(corrector_output.get("reason")),
        "generated_answer_preview": _preview(generated_answer or ""),
        "final_answer_preview": _preview(final_answer or ""),
    }


def _latency_summary(agent_runs: list[AgentRun]) -> dict[str, object]:
    by_agent_type: dict[str, int] = {}
    total = 0
    for run in agent_runs:
        latency = int(run.latency_ms or 0)
        by_agent_type[run.agent_type] = by_agent_type.get(run.agent_type, 0) + latency
        total += latency
    return {"total_latency_ms": total, "by_agent_type": by_agent_type}


async def _average_latency_by_agent(db: AsyncSession) -> dict[str, float]:
    rows = await db.execute(
        select(
            AgentRun.agent_type,
            func.avg(AgentRun.latency_ms).label("average_latency_ms"),
            func.count(AgentRun.id).label("run_count"),
        )
        .group_by(AgentRun.agent_type)
        .order_by(desc(func.avg(AgentRun.latency_ms)))
    )
    return {str(row.agent_type): _float_or_zero(row.average_latency_ms) for row in rows.all()}


def _worst_message(item: dict[str, object]) -> dict[str, object]:
    return {
        "message_id": item["message_id"],
        "conversation_id": item["conversation_id"],
        "workspace_id": item["workspace_id"],
        "workspace_name": item["workspace_name"],
        "user_email": item["user_email"],
        "question_preview": item["question_preview"],
        "answer_preview": item["answer_preview"],
        "faithfulness": item["faithfulness"],
        "relevance": item["relevance"],
        "context_precision": item["context_precision"],
        "hallucination_score": item["hallucination_score"],
        "created_at": item["created_at"],
    }


async def _audit_trace_access(
    db: AsyncSession,
    *,
    actor: User,
    message_id: UUID,
    include_content: bool,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="RAG_TRACE_VIEWED",
            target_type="message",
            target_id=message_id,
            metadata_={"include_content": include_content},
            reason=None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    if include_content:
        db.add(
            AuditLog(
                actor_user_id=actor.id,
                action="FULL_CHUNK_CONTENT_VIEWED",
                target_type="message",
                target_id=message_id,
                metadata_={"source": "rag_trace", "include_content": True},
                reason=None,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )
    await db.commit()


def _ensure_content_access(*, actor: User, include_content: bool) -> None:
    if include_content and actor.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can include full chunk content",
        )


def _sanitize_payload(value: Any, *, include_content: bool) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            key_string = str(key)
            lowered = key_string.lower()
            if any(marker in lowered for marker in SECRET_KEY_MARKERS):
                sanitized[key_string] = "[redacted]"
                continue
            if lowered == "content" and isinstance(item, str) and not include_content:
                sanitized[key_string] = _preview(item)
                continue
            sanitized[key_string] = _sanitize_payload(item, include_content=include_content)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_payload(item, include_content=include_content) for item in value]
    if isinstance(value, str) and not include_content:
        return _preview(value, max_chars=500)
    return value


def _evaluation_method(explanation: str | None, agent_runs: list[AgentRun]) -> str:
    normalized = (explanation or "").lower()
    evaluator = _latest_agent_run(agent_runs, "evaluator")
    if "heuristic fallback" in normalized or "heuristic" in normalized:
        return "heuristic"
    if evaluator is None or evaluator.status != "completed":
        return "fallback"
    return "llm"


def _source_scores(chunk: dict[str, Any]) -> dict[str, float]:
    metadata = chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
    source_scores = metadata.get("source_scores")
    if not isinstance(source_scores, dict):
        return {}
    scores: dict[str, float] = {}
    for key, value in source_scores.items():
        scores[str(key)] = _float_or_zero(value)
    return scores


def _preview(value: str, max_chars: int = PREVIEW_CHARS) -> str:
    normalized = " ".join(str(value).split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 3]}..."


def _average(values: Any) -> float:
    numbers = [float(value) for value in values]
    if not numbers:
        return 0.0
    return round(sum(numbers) / len(numbers), 4)


def _float_or_zero(value: object) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _int_or_zero(value: object) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _uuid_or_none(value: object) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except ValueError:
        return None


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    return str(value)
