from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import desc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import AgentRun, Conversation, Evaluation, LLMUsage
from app.models.document import Chunk, Document
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


RECENT_LIMIT = 10
ERROR_LIMIT = 25


async def list_users(db: AsyncSession, limit: int | None = None) -> list[dict[str, object]]:
    statement = (
        select(
            User.id,
            User.email,
            User.full_name,
            User.role,
            User.is_active,
            User.created_at,
            func.count(distinct(WorkspaceMember.workspace_id)).label("workspace_count"),
            func.count(distinct(Document.id)).label("document_count"),
            func.count(distinct(Conversation.id)).label("conversation_count"),
        )
        .outerjoin(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .outerjoin(Document, Document.uploaded_by == User.id)
        .outerjoin(Conversation, Conversation.user_id == User.id)
        .group_by(User.id)
        .order_by(desc(User.created_at))
    )
    if limit is not None:
        statement = statement.limit(limit)

    result = await db.execute(statement)
    return [
        {
            "id": row.id,
            "email": row.email,
            "full_name": row.full_name,
            "role": row.role,
            "is_active": row.is_active,
            "created_at": row.created_at,
            "workspace_count": int(row.workspace_count or 0),
            "document_count": int(row.document_count or 0),
            "conversation_count": int(row.conversation_count or 0),
        }
        for row in result.all()
    ]


async def list_workspaces(
    db: AsyncSession,
    limit: int | None = None,
) -> list[dict[str, object]]:
    statement = (
        select(
            Workspace.id,
            Workspace.name,
            Workspace.owner_id,
            User.email.label("owner_email"),
            Workspace.created_at,
            Workspace.updated_at,
            func.count(distinct(Document.id)).label("document_count"),
            func.count(distinct(Conversation.id)).label("conversation_count"),
        )
        .join(User, User.id == Workspace.owner_id)
        .outerjoin(Document, Document.workspace_id == Workspace.id)
        .outerjoin(Conversation, Conversation.workspace_id == Workspace.id)
        .group_by(Workspace.id, User.email)
        .order_by(desc(Workspace.updated_at))
    )
    if limit is not None:
        statement = statement.limit(limit)

    result = await db.execute(statement)
    return [
        {
            "id": row.id,
            "name": row.name,
            "owner_id": row.owner_id,
            "owner_email": row.owner_email,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "document_count": int(row.document_count or 0),
            "conversation_count": int(row.conversation_count or 0),
        }
        for row in result.all()
    ]


async def get_documents_stats(db: AsyncSession) -> dict[str, object]:
    total_documents = await _count(db, Document.id)
    total_chunks = await _count(db, Chunk.id)

    status_result = await db.execute(
        select(Document.status, func.count(Document.id))
        .group_by(Document.status)
        .order_by(Document.status)
    )
    documents_by_status = {
        str(status): int(count or 0)
        for status, count in status_result.all()
    }

    recent_result = await db.execute(
        select(
            Document.id,
            Document.workspace_id,
            Workspace.name.label("workspace_name"),
            Document.filename,
            Document.file_type,
            Document.status,
            Document.uploaded_by,
            User.email.label("uploader_email"),
            Document.created_at,
            Document.processed_at,
        )
        .join(Workspace, Workspace.id == Document.workspace_id)
        .outerjoin(User, User.id == Document.uploaded_by)
        .order_by(desc(Document.created_at))
        .limit(RECENT_LIMIT)
    )
    recent_documents = [
        {
            "id": row.id,
            "workspace_id": row.workspace_id,
            "workspace_name": row.workspace_name,
            "filename": row.filename,
            "file_type": row.file_type,
            "status": row.status,
            "uploaded_by": row.uploaded_by,
            "uploader_email": row.uploader_email,
            "created_at": row.created_at,
            "processed_at": row.processed_at,
        }
        for row in recent_result.all()
    ]

    return {
        "total_documents": total_documents,
        "documents_by_status": documents_by_status,
        "total_chunks": total_chunks,
        "recent_documents": recent_documents,
    }


async def get_rag_stats(db: AsyncSession) -> dict[str, object]:
    total_conversations = await _count(db, Conversation.id)
    total_rag_queries = await _count(db, LLMUsage.id)

    result = await db.execute(
        select(
            func.avg(LLMUsage.latency_ms),
            func.avg(Evaluation.faithfulness),
            func.avg(Evaluation.relevance),
        ).select_from(LLMUsage).outerjoin(Evaluation, Evaluation.message_id == LLMUsage.message_id)
    )
    average_latency_ms, average_faithfulness, average_relevance = result.one()

    return {
        "total_conversations": total_conversations,
        "total_rag_queries": total_rag_queries,
        "average_latency_ms": _float_or_zero(average_latency_ms),
        "average_faithfulness": _float_or_zero(average_faithfulness),
        "average_relevance": _float_or_zero(average_relevance),
    }


async def get_usage_stats(db: AsyncSession) -> dict[str, object]:
    result = await db.execute(
        select(
            func.coalesce(func.sum(LLMUsage.prompt_tokens), 0),
            func.coalesce(func.sum(LLMUsage.completion_tokens), 0),
            func.coalesce(func.sum(LLMUsage.total_tokens), 0),
            func.coalesce(func.sum(LLMUsage.estimated_cost), 0),
        )
    )
    prompt_tokens, completion_tokens, total_tokens, estimated_cost = result.one()

    return {
        "prompt_tokens": int(prompt_tokens or 0),
        "completion_tokens": int(completion_tokens or 0),
        "total_tokens": int(total_tokens or 0),
        "estimated_cost_usd": _float_or_zero(estimated_cost),
    }


async def list_errors(db: AsyncSession, limit: int = ERROR_LIMIT) -> dict[str, object]:
    failed_documents_result = await db.execute(
        select(Document)
        .where(Document.status == "failed")
        .order_by(desc(Document.created_at))
        .limit(limit)
    )
    failed_agent_runs_result = await db.execute(
        select(AgentRun)
        .where(AgentRun.status == "failed")
        .order_by(desc(AgentRun.created_at))
        .limit(limit)
    )

    errors: list[dict[str, object]] = []
    for document in failed_documents_result.scalars().all():
        errors.append(
            {
                "id": document.id,
                "source": "document",
                "message": f"Document processing failed for {document.filename}",
                "status": document.status,
                "created_at": document.processed_at or document.created_at,
                "context": {
                    "document_id": str(document.id),
                    "workspace_id": str(document.workspace_id),
                    "filename": document.filename,
                    "file_type": document.file_type,
                },
            }
        )

    for agent_run in failed_agent_runs_result.scalars().all():
        output = agent_run.output if isinstance(agent_run.output, dict) else {}
        error_message = output.get("error")
        errors.append(
            {
                "id": agent_run.id,
                "source": "agent_run",
                "message": str(error_message or f"{agent_run.agent_type} failed"),
                "status": agent_run.status,
                "created_at": agent_run.created_at,
                "context": {
                    "agent_type": agent_run.agent_type,
                    "message_id": str(agent_run.message_id),
                },
            }
        )

    errors.sort(key=lambda item: item["created_at"], reverse=True)
    return {"errors": errors[:limit]}


async def _count(db: AsyncSession, column: Any) -> int:
    value = await db.scalar(select(func.count(column)))
    return int(value or 0)


def _float_or_zero(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)
