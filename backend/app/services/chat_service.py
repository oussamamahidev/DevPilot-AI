from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime
from time import perf_counter
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.rag import (
    AgenticRAGWorkflow,
    CorrectorAgent,
    QueryRewriterAgent,
    RouterAgent,
    _build_generation_prompt,
    _candidate_top_k,
    _ensure_answer_has_citation,
    _json_safe,
    _top_retrieval_score,
)
from app.core.config import settings
from app.core.metrics import LLM_TOKENS_TOTAL, RAG_QUERIES_TOTAL, RAG_QUERY_DURATION_SECONDS
from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    LLMUsage,
    Message,
    RetrievedChunk,
)
from app.models.document import Chunk
from app.models.user import User
from app.models.workspace import Workspace
from app.providers.base import (
    EmbeddingProviderError,
    LLMProviderError,
    LLMResponse,
    chunk_text,
)
from app.providers.factory import get_llm_provider
from app.providers.ollama_provider import DEFAULT_RAG_SYSTEM_PROMPT
from app.services.evaluation_service import evaluate_answer
from app.services.reranking_service import rerank
from app.services.retrieval_service import retrieve_chunks
from app.services.vector_store_service import VectorStoreError


class ConversationNotFoundError(RuntimeError):
    pass


StreamEvent = tuple[str, dict[str, object]]
AgentOperation = Callable[[], Awaitable[dict[str, Any]]]
AgentRunLogger = Callable[
    [str, dict[str, object], dict[str, object] | None, int | None, str],
    None,
]


async def query_chat(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None = None,
    retrieval_strategy: str = "hybrid",
) -> dict[str, object]:
    started_at = perf_counter()
    status = "success"
    try:
        return await _query_chat_impl(
            db=db,
            workspace=workspace,
            user=user,
            question=question,
            conversation_id=conversation_id,
            retrieval_strategy=retrieval_strategy,
        )
    except Exception:
        status = "error"
        raise
    finally:
        RAG_QUERIES_TOTAL.labels(status=status).inc()
        RAG_QUERY_DURATION_SECONDS.labels(status=status).observe(perf_counter() - started_at)


async def stream_chat_events(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None = None,
    retrieval_strategy: str = "hybrid",
) -> AsyncIterator[StreamEvent]:
    started_at = perf_counter()
    status = "success"
    try:
        async for event in _stream_chat_impl(
            db=db,
            workspace=workspace,
            user=user,
            question=question,
            conversation_id=conversation_id,
            retrieval_strategy=retrieval_strategy,
        ):
            yield event
    except asyncio.CancelledError:
        status = "cancelled"
        rollback = getattr(db, "rollback", None)
        if rollback is not None:
            await rollback()
        raise
    except Exception as exc:
        status = "error"
        rollback = getattr(db, "rollback", None)
        if rollback is not None:
            await rollback()
        yield ("error", {"message": _clean_stream_error(exc)})
    finally:
        RAG_QUERIES_TOTAL.labels(status=status).inc()
        RAG_QUERY_DURATION_SECONDS.labels(status=status).observe(perf_counter() - started_at)


async def _query_chat_impl(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None = None,
    retrieval_strategy: str = "hybrid",
) -> dict[str, object]:
    conversation = await _get_or_create_conversation(
        db=db,
        workspace=workspace,
        user=user,
        question=question,
        conversation_id=conversation_id,
    )
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=question,
    )
    conversation.updated_at = datetime.now(UTC)
    db.add(user_message)
    await db.commit()

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content="",
    )
    conversation.updated_at = datetime.now(UTC)
    db.add(assistant_message)
    await db.flush()

    def log_agent_run(
        agent_type: str,
        input_payload: dict[str, object],
        output_payload: dict[str, object] | None,
        latency_ms: int | None,
        status: str,
    ) -> None:
        db.add(
            AgentRun(
                message_id=assistant_message.id,
                agent_type=agent_type,
                status=status,
                input=input_payload,
                output=output_payload,
                latency_ms=latency_ms,
            )
        )

    workflow = AgenticRAGWorkflow(
        retriever=retrieve_chunks,
        reranker=rerank,
        llm_provider_factory=get_llm_provider,
        evaluator=evaluate_answer,
        run_logger=log_agent_run,
    )
    workflow_result = await workflow.run(
        db=db,
        workspace_id=workspace.id,
        question=question,
        retrieval_strategy=retrieval_strategy,
    )

    assistant_message.content = workflow_result.final_answer
    prompt_chunks = workflow_result.retrieved_chunks
    citations = _build_citations(prompt_chunks)

    for rank, chunk in enumerate(prompt_chunks, start=1):
        db.add(
            RetrievedChunk(
                message_id=assistant_message.id,
                chunk_id=chunk["chunk_id"],
                score=float(chunk["score"]),
                rank=rank,
                retrieval_strategy=workflow_result.retrieval_strategy,
            )
        )

    db.add(
        LLMUsage(
            message_id=assistant_message.id,
            provider=settings.llm_provider,
            model=workflow_result.llm_response.model,
            prompt_tokens=workflow_result.llm_response.prompt_tokens,
            completion_tokens=workflow_result.llm_response.completion_tokens,
            total_tokens=workflow_result.llm_response.total_tokens,
            latency_ms=workflow_result.llm_response.latency_ms,
        )
    )
    _record_llm_token_metrics(
        provider=settings.llm_provider,
        model=workflow_result.llm_response.model,
        prompt_tokens=workflow_result.llm_response.prompt_tokens,
        completion_tokens=workflow_result.llm_response.completion_tokens,
        total_tokens=workflow_result.llm_response.total_tokens,
    )

    evaluation = workflow_result.evaluation
    db.add(
        Evaluation(
            message_id=assistant_message.id,
            faithfulness=evaluation["faithfulness"],
            relevance=evaluation["relevance"],
            context_precision=evaluation["context_precision"],
            hallucination_score=evaluation["hallucination_score"],
            explanation=evaluation["explanation"],
        )
    )
    await db.commit()

    return {
        "answer": workflow_result.final_answer,
        "citations": citations,
        "conversation_id": conversation.id,
        "message_id": assistant_message.id,
        "evaluation": evaluation,
    }


async def _stream_chat_impl(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None = None,
    retrieval_strategy: str = "hybrid",
) -> AsyncIterator[StreamEvent]:
    conversation = await _get_or_create_conversation(
        db=db,
        workspace=workspace,
        user=user,
        question=question,
        conversation_id=conversation_id,
    )
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=question,
    )
    conversation.updated_at = datetime.now(UTC)
    db.add(user_message)
    await db.commit()

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content="",
    )
    conversation.updated_at = datetime.now(UTC)
    db.add(assistant_message)
    await db.flush()

    def log_agent_run(
        agent_type: str,
        input_payload: dict[str, object],
        output_payload: dict[str, object] | None,
        latency_ms: int | None,
        run_status: str,
    ) -> None:
        db.add(
            AgentRun(
                message_id=assistant_message.id,
                agent_type=agent_type,
                status=run_status,
                input=_json_safe(input_payload),
                output=_json_safe(output_payload) if output_payload is not None else None,
                latency_ms=latency_ms,
            )
        )

    yield (
        "start",
        {
            "workspace_id": str(workspace.id),
            "conversation_id": str(conversation.id),
            "retrieval_strategy": retrieval_strategy,
        },
    )

    router = RouterAgent()
    router_output = await _run_stream_agent(
        agent_type=RouterAgent.agent_type,
        input_payload={"question": question},
        operation=lambda: router.run(question),
        run_logger=log_agent_run,
    )
    query_type = str(router_output["query_type"])

    yield ("trace", {"stage": "query_rewriter", "status": "started"})
    query_rewriter = QueryRewriterAgent()
    rewrite_output = await _run_stream_agent(
        agent_type=QueryRewriterAgent.agent_type,
        input_payload={"question": question, "query_type": query_type},
        operation=lambda: query_rewriter.run(
            question=question,
            query_type=query_type,
        ),
        run_logger=log_agent_run,
    )
    rewritten_query = str(rewrite_output["query"])
    yield (
        "trace",
        {
            "stage": "query_rewriter",
            "status": "completed",
            "changed": bool(rewrite_output.get("changed")),
        },
    )

    yield ("trace", {"stage": "retrieval", "status": "started"})
    retrieval_output = await _run_stream_agent(
        agent_type="retrieval",
        input_payload={
            "query": rewritten_query,
            "retrieval_strategy": retrieval_strategy,
            "top_k": _candidate_top_k(),
        },
        operation=lambda: _retrieve_for_stream(
            db=db,
            workspace_id=workspace.id,
            query=rewritten_query,
            retrieval_strategy=retrieval_strategy,
        ),
        run_logger=log_agent_run,
    )
    candidate_chunks = list(retrieval_output["chunks"])
    yield (
        "trace",
        {
            "stage": "retrieval",
            "status": "completed",
            "retrieved_count": len(candidate_chunks),
        },
    )

    if settings.enable_reranking:
        yield ("trace", {"stage": "reranker", "status": "started"})
        reranking_output = await _run_stream_agent(
            agent_type="reranker",
            input_payload={
                "query": rewritten_query,
                "candidate_count": len(candidate_chunks),
                "top_k": settings.rerank_top_k,
            },
            operation=lambda: _rerank_for_stream(
                query=rewritten_query,
                contexts=candidate_chunks,
            ),
            run_logger=log_agent_run,
        )
        retrieved_chunks = list(reranking_output["chunks"])
        yield (
            "trace",
            {
                "stage": "reranker",
                "status": "completed",
                "reranked_count": len(retrieved_chunks),
            },
        )
    else:
        retrieved_chunks = candidate_chunks[: settings.rag_top_k]
        yield (
            "trace",
            {
                "stage": "reranker",
                "status": "skipped",
                "reranked_count": len(retrieved_chunks),
            },
        )

    yield ("trace", {"stage": "generator", "status": "started"})
    prompt = _build_generation_prompt(
        question=question,
        rewritten_query=rewritten_query,
        contexts=retrieved_chunks,
    )
    provider = get_llm_provider()
    generation_started_at = perf_counter()
    generator_input = {
        "question": question,
        "rewritten_query": rewritten_query,
        "context_count": len(retrieved_chunks),
    }
    raw_parts: list[str] = []
    llm_response: LLMResponse | None = None

    try:
        stream_generate = getattr(provider, "stream_generate", None)
        if callable(stream_generate):
            async for token in stream_generate(
                prompt=prompt,
                system_prompt=DEFAULT_RAG_SYSTEM_PROMPT,
            ):
                if token:
                    raw_parts.append(token)
                    yield ("token", {"text": token})
        else:
            llm_response = await provider.generate(
                prompt=prompt,
                system_prompt=DEFAULT_RAG_SYSTEM_PROMPT,
            )
            async for token in chunk_text(llm_response.content):
                raw_parts.append(token)
                yield ("token", {"text": token})
    except Exception as exc:
        latency_ms = int((perf_counter() - generation_started_at) * 1000)
        log_agent_run(
            "generator",
            generator_input,
            {"error": str(exc)},
            latency_ms,
            "failed",
        )
        raise

    raw_answer = "".join(raw_parts).strip()
    if not raw_answer:
        exc = LLMProviderError("The generation provider returned an empty response.")
        latency_ms = int((perf_counter() - generation_started_at) * 1000)
        log_agent_run(
            "generator",
            generator_input,
            {"error": str(exc)},
            latency_ms,
            "failed",
        )
        raise exc

    generated_answer = _ensure_answer_has_citation(raw_answer, retrieved_chunks)
    if generated_answer != raw_answer:
        suffix = generated_answer[len(raw_answer) :] if generated_answer.startswith(raw_answer) else ""
        if suffix:
            yield ("token", {"text": suffix})

    generation_latency_ms = int((perf_counter() - generation_started_at) * 1000)
    if llm_response is None:
        llm_response = LLMResponse(
            content=generated_answer,
            model=str(getattr(provider, "model", settings.active_generation_model)),
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            latency_ms=generation_latency_ms,
        )
    else:
        llm_response = LLMResponse(
            content=generated_answer,
            model=llm_response.model,
            prompt_tokens=llm_response.prompt_tokens,
            completion_tokens=llm_response.completion_tokens,
            total_tokens=llm_response.total_tokens,
            latency_ms=llm_response.latency_ms or generation_latency_ms,
        )

    log_agent_run(
        "generator",
        generator_input,
        {"answer": generated_answer, "llm_response": llm_response},
        generation_latency_ms,
        "completed",
    )
    yield ("trace", {"stage": "generator", "status": "completed"})

    yield ("trace", {"stage": "evaluator", "status": "started"})
    evaluation = await _run_stream_agent(
        agent_type="evaluator",
        input_payload={
            "question": question,
            "answer": generated_answer,
            "context_count": len(retrieved_chunks),
        },
        operation=lambda: evaluate_answer(
            question=question,
            answer=generated_answer,
            contexts=retrieved_chunks,
        ),
        run_logger=log_agent_run,
    )
    yield ("trace", {"stage": "evaluator", "status": "completed"})

    yield ("trace", {"stage": "corrector", "status": "started"})
    corrector = CorrectorAgent()
    correction_output = await _run_stream_agent(
        agent_type=CorrectorAgent.agent_type,
        input_payload={
            "answer": generated_answer,
            "evaluation": evaluation,
            "context_count": len(retrieved_chunks),
            "top_retrieval_score": _top_retrieval_score(retrieved_chunks),
        },
        operation=lambda: corrector.run(
            answer=generated_answer,
            evaluation=evaluation,
            contexts=retrieved_chunks,
            question=question,
        ),
        run_logger=log_agent_run,
    )
    yield ("trace", {"stage": "corrector", "status": "completed"})

    final_answer = str(correction_output["answer"])
    final_evaluation = correction_output["evaluation"]
    corrected = bool(correction_output.get("correction_applied")) or final_answer != generated_answer

    if corrected:
        yield (
            "correction",
            {
                "corrected": True,
                "final_answer": final_answer,
                "reason": str(correction_output.get("reason", "")),
            },
        )

    assistant_message.content = final_answer
    citations = _build_citations(retrieved_chunks)

    for rank, chunk in enumerate(retrieved_chunks, start=1):
        db.add(
            RetrievedChunk(
                message_id=assistant_message.id,
                chunk_id=chunk["chunk_id"],
                score=float(chunk["score"]),
                rank=rank,
                retrieval_strategy=retrieval_strategy,
            )
        )

    db.add(
        LLMUsage(
            message_id=assistant_message.id,
            provider=settings.llm_provider,
            model=llm_response.model,
            prompt_tokens=llm_response.prompt_tokens,
            completion_tokens=llm_response.completion_tokens,
            total_tokens=llm_response.total_tokens,
            latency_ms=llm_response.latency_ms,
        )
    )
    _record_llm_token_metrics(
        provider=settings.llm_provider,
        model=llm_response.model,
        prompt_tokens=llm_response.prompt_tokens,
        completion_tokens=llm_response.completion_tokens,
        total_tokens=llm_response.total_tokens,
    )

    db.add(
        Evaluation(
            message_id=assistant_message.id,
            faithfulness=final_evaluation["faithfulness"],
            relevance=final_evaluation["relevance"],
            context_precision=final_evaluation["context_precision"],
            hallucination_score=final_evaluation["hallucination_score"],
            explanation=final_evaluation["explanation"],
        )
    )
    await db.commit()

    yield ("citations", {"citations": citations})
    yield ("evaluation", {"evaluation": final_evaluation})
    yield (
        "message",
        {
            "message_id": str(assistant_message.id),
            "conversation_id": str(conversation.id),
        },
    )
    yield ("done", {"status": "completed"})


async def _retrieve_for_stream(
    *,
    db: AsyncSession,
    workspace_id: UUID,
    query: str,
    retrieval_strategy: str,
) -> dict[str, object]:
    chunks = await retrieve_chunks(
        db=db,
        workspace_id=workspace_id,
        query=query,
        top_k=_candidate_top_k(),
        strategy=retrieval_strategy,
    )
    return {
        "retrieval_strategy": retrieval_strategy,
        "chunks": chunks,
    }


async def _rerank_for_stream(
    *,
    query: str,
    contexts: list[dict[str, Any]],
) -> dict[str, object]:
    chunks = await rerank(
        query=query,
        contexts=contexts,
        top_k=settings.rerank_top_k,
    )
    return {
        "chunks": chunks,
        "input_count": len(contexts),
        "top_k": settings.rerank_top_k,
    }


async def _run_stream_agent(
    *,
    agent_type: str,
    input_payload: dict[str, object],
    operation: AgentOperation,
    run_logger: AgentRunLogger,
) -> dict[str, Any]:
    started_at = perf_counter()
    try:
        output = await operation()
    except Exception as exc:
        latency_ms = int((perf_counter() - started_at) * 1000)
        run_logger(
            agent_type,
            input_payload,
            {"error": str(exc)},
            latency_ms,
            "failed",
        )
        raise

    latency_ms = int((perf_counter() - started_at) * 1000)
    run_logger(
        agent_type,
        input_payload,
        output,
        latency_ms,
        "completed",
    )
    return output


def _record_llm_token_metrics(
    *,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
) -> None:
    for token_type, value in (
        ("prompt", prompt_tokens),
        ("completion", completion_tokens),
        ("total", total_tokens),
    ):
        LLM_TOKENS_TOTAL.labels(
            provider=provider,
            model=model,
            token_type=token_type,
        ).inc(max(value, 0))


async def list_workspace_conversations(
    db: AsyncSession,
    workspace_id: UUID,
) -> list[Conversation]:
    result = await db.scalars(
        select(Conversation)
        .where(Conversation.workspace_id == workspace_id)
        .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
    )
    return list(result.all())


async def get_conversation_detail(
    db: AsyncSession,
    conversation_id: UUID,
    workspace_id: UUID,
) -> dict[str, object]:
    conversation = await db.scalar(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
        )
        .options(
            selectinload(Conversation.messages)
            .selectinload(Message.retrieved_chunks)
            .selectinload(RetrievedChunk.chunk)
            .selectinload(Chunk.document)
        )
    )
    if conversation is None:
        raise ConversationNotFoundError("Conversation not found or access denied")

    messages = sorted(conversation.messages, key=lambda message: message.created_at)
    return {
        "id": conversation.id,
        "workspace_id": conversation.workspace_id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
                "citations": _citations_from_retrieved_chunks(message.retrieved_chunks),
            }
            for message in messages
        ],
        "metadata": {},
    }


async def get_conversation_workspace_id(
    db: AsyncSession,
    conversation_id: UUID,
) -> UUID | None:
    return await db.scalar(
        select(Conversation.workspace_id).where(Conversation.id == conversation_id)
    )


async def _get_or_create_conversation(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None,
) -> Conversation:
    if conversation_id is not None:
        conversation = await db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == workspace.id,
            )
        )
        if conversation is None:
            raise ConversationNotFoundError("Conversation not found or access denied")
        return conversation

    conversation = Conversation(
        workspace_id=workspace.id,
        user_id=user.id,
        title=_title_from_question(question),
    )
    db.add(conversation)
    await db.flush()
    return conversation


def _clean_stream_error(exc: Exception) -> str:
    if isinstance(exc, ConversationNotFoundError):
        return "Conversation not found or access denied."
    if isinstance(exc, (EmbeddingProviderError, LLMProviderError, VectorStoreError)):
        return str(exc)
    return "Unable to generate an answer right now. Please retry."


def _title_from_question(question: str) -> str:
    normalized = " ".join(question.split())
    return normalized[:80] if normalized else "New conversation"


def _build_user_prompt(
    question: str,
    retrieved_chunks: list[dict[str, object]],
) -> str:
    context = _build_context(retrieved_chunks)
    return f"""Context:
{context}

Question:
{question}

Answer:"""


def _build_context(retrieved_chunks: list[dict[str, object]]) -> str:
    if not retrieved_chunks:
        return "No retrieved context was available."

    blocks: list[str] = []
    for citation_id, chunk in enumerate(retrieved_chunks, start=1):
        blocks.append(
            f"""[{citation_id}] Source: {chunk["filename"]} | Chunk: {chunk["chunk_index"]}
Content:
{chunk["content"]}"""
        )
    return "\n\n".join(blocks)


def _build_citations(retrieved_chunks: list[dict[str, object]]) -> list[dict[str, object]]:
    return [
        {
            "id": citation_id,
            "document_id": chunk["document_id"],
            "filename": chunk["filename"],
            "chunk_id": chunk["chunk_id"],
            "chunk_index": chunk["chunk_index"],
            "score": chunk["score"],
        }
        for citation_id, chunk in enumerate(retrieved_chunks, start=1)
    ]


def _citations_from_retrieved_chunks(
    retrieved_chunks: list[RetrievedChunk],
) -> list[dict[str, object]]:
    citations: list[dict[str, object]] = []
    for retrieved_chunk in sorted(retrieved_chunks, key=lambda item: item.rank):
        chunk = retrieved_chunk.chunk
        document = chunk.document
        citations.append(
            {
                "id": retrieved_chunk.rank,
                "document_id": chunk.document_id,
                "filename": document.filename,
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "score": retrieved_chunk.score,
            }
        )
    return citations
