from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    LLMUsage,
    Message,
    RetrievedChunk,
)
from app.models.document import Chunk, Document
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.services import document_service, vector_store_service


ROLE_VALUES = {"user", "admin", "super_admin"}
DOCUMENT_STATUSES = ("indexed", "queued", "processing", "failed", "deleted")
RECENT_LIMIT = 10
DETAIL_DOCUMENT_LIMIT = 100
ERROR_LIMIT = 25
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
AUDIT_LOG_LIMIT = 200


async def get_stats(db: AsyncSession) -> dict[str, object]:
    users_by_role_result = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role).order_by(User.role)
    )
    users_by_role = {str(role): int(count or 0) for role, count in users_by_role_result.all()}

    document_status_counts = await _document_status_counts(db)

    rag_result = await db.execute(
        select(
            func.avg(LLMUsage.latency_ms),
            func.avg(Evaluation.faithfulness),
            func.avg(Evaluation.relevance),
        )
        .select_from(LLMUsage)
        .outerjoin(Evaluation, Evaluation.message_id == LLMUsage.message_id)
    )
    average_latency_ms, average_faithfulness, average_relevance = rag_result.one()

    usage_result = await db.execute(
        select(
            func.coalesce(func.sum(LLMUsage.prompt_tokens), 0),
            func.coalesce(func.sum(LLMUsage.completion_tokens), 0),
            func.coalesce(func.sum(LLMUsage.total_tokens), 0),
            func.coalesce(func.sum(LLMUsage.estimated_cost), 0),
        )
    )
    prompt_tokens, completion_tokens, total_tokens, estimated_cost = usage_result.one()

    agent_latency_rows = await db.execute(
        select(AgentRun.agent_type, func.avg(AgentRun.latency_ms))
        .group_by(AgentRun.agent_type)
        .order_by(AgentRun.agent_type)
    )
    avg_latency_ms_by_agent = {
        str(agent_type): _float_or_zero(average_latency)
        for agent_type, average_latency in agent_latency_rows.all()
    }

    active_users = await _count_where(
        db,
        User.id,
        User.is_active.is_(True),
        User.deleted_at.is_(None),
    )
    inactive_users = await _count_where(
        db,
        User.id,
        User.is_active.is_(False),
        User.deleted_at.is_(None),
    )
    deleted_users = await _count_where(db, User.id, User.deleted_at.is_not(None))
    admin_count = await _count_where(
        db,
        User.id,
        User.role == "admin",
        User.deleted_at.is_(None),
    )
    super_admin_count = await _count_where(
        db,
        User.id,
        User.role == "super_admin",
        User.deleted_at.is_(None),
    )
    total_documents = await _count(db, Document.id)
    total_chunks = await _count(db, Chunk.id)
    total_conversations = await _count(db, Conversation.id)
    total_rag_queries = await _count(db, LLMUsage.id)

    return {
        "users": {
            "total": await _count(db, User.id),
            "active": active_users,
            "inactive": inactive_users,
            "deleted": deleted_users,
            "admins": admin_count,
            "super_admins": super_admin_count,
        },
        "workspaces": {
            "total": await _count(db, Workspace.id),
        },
        "documents": {
            "total": total_documents,
            "indexed": document_status_counts.get("indexed", 0),
            "queued": document_status_counts.get("queued", 0),
            "processing": document_status_counts.get("processing", 0),
            "failed": document_status_counts.get("failed", 0),
            "deleted": document_status_counts.get("deleted", 0),
        },
        "rag": {
            "conversations": total_conversations,
            "messages": await _count(db, Message.id),
            "evaluations": await _count(db, Evaluation.id),
            "retrieved_chunks": await _count(db, RetrievedChunk.id),
        },
        "agents": {
            "runs": await _count(db, AgentRun.id),
            "avg_latency_ms_by_agent": avg_latency_ms_by_agent,
        },
        "total_users": await _count(db, User.id),
        "active_users": active_users,
        "inactive_users": inactive_users,
        "deleted_users": deleted_users,
        "users_by_role": users_by_role,
        "total_workspaces": await _count(db, Workspace.id),
        "total_documents": total_documents,
        "documents_by_status": document_status_counts,
        "total_chunks": total_chunks,
        "total_conversations": total_conversations,
        "total_rag_queries": total_rag_queries,
        "average_latency_ms": _float_or_zero(average_latency_ms),
        "average_faithfulness": _float_or_zero(average_faithfulness),
        "average_relevance": _float_or_zero(average_relevance),
        "prompt_tokens": int(prompt_tokens or 0),
        "completion_tokens": int(completion_tokens or 0),
        "total_tokens": int(total_tokens or 0),
        "estimated_cost_usd": _float_or_zero(estimated_cost),
    }


async def list_users(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
) -> dict[str, object]:
    page, page_size, offset = _pagination(page=page, page_size=page_size)
    statement = (
        select(
            User.id,
            User.email,
            User.full_name,
            User.role,
            User.is_active,
            User.deleted_at,
            User.deactivated_at,
            User.last_login_at,
            User.created_at,
            func.count(distinct(WorkspaceMember.workspace_id)).label("workspace_count"),
            func.count(distinct(Document.id)).label("document_count"),
        )
        .outerjoin(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .outerjoin(Document, Document.uploaded_by == User.id)
        .group_by(User.id)
    )
    statement = _apply_user_filters(statement, search=search, role=role, is_active=is_active)
    total = await _count_statement_rows(db, statement)
    rows = await db.execute(statement.order_by(desc(User.created_at)).offset(offset).limit(page_size))
    return {
        "items": [
            {
                "id": row.id,
                "email": row.email,
                "full_name": row.full_name,
                "role": row.role,
                "is_active": row.is_active,
                "deleted_at": row.deleted_at,
                "deactivated_at": row.deactivated_at,
                "created_at": row.created_at,
                "last_login_at": row.last_login_at,
                "workspace_count": int(row.workspace_count or 0),
                "document_count": int(row.document_count or 0),
            }
            for row in rows.all()
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_user_detail(db: AsyncSession, user_id: UUID) -> dict[str, object]:
    user = await _get_user_or_404(db, user_id)
    workspace_count = await _count_where(
        db,
        WorkspaceMember.workspace_id,
        WorkspaceMember.user_id == user.id,
    )
    owned_workspace_count = await _count_where(db, Workspace.id, Workspace.owner_id == user.id)
    document_count = await _count_where(db, Document.id, Document.uploaded_by == user.id)
    conversation_count = await _count_where(db, Conversation.id, Conversation.user_id == user.id)

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "deleted_at": user.deleted_at,
        "deactivated_at": user.deactivated_at,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "workspace_count": workspace_count,
        "owned_workspace_count": owned_workspace_count,
        "document_count": document_count,
        "conversation_count": conversation_count,
        "recent_audit_events": await _recent_audit_events_for_user(db, user.id),
    }


async def change_user_role(
    db: AsyncSession,
    *,
    actor: User,
    user_id: UUID,
    new_role: str,
    reason: str,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    if new_role not in ROLE_VALUES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")

    target = await _get_user_or_404(db, user_id)
    _ensure_reason(reason)
    _ensure_actor_can_change_role(actor=actor, target=target, new_role=new_role)
    if target.role == "super_admin" and new_role != "super_admin":
        await _ensure_not_last_active_super_admin(db, target)

    old_role = target.role
    target.role = new_role
    await _create_audit_log(
        db,
        actor=actor,
        action="USER_ROLE_CHANGED",
        target_type="user",
        target_id=target.id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata={"email": target.email, "old_role": old_role, "new_role": new_role},
    )
    await db.commit()
    return await get_user_detail(db, target.id)


async def deactivate_user(
    db: AsyncSession,
    *,
    actor: User,
    user_id: UUID,
    reason: str,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    target = await _get_user_or_404(db, user_id)
    _ensure_reason(reason)
    _ensure_actor_can_manage_lifecycle(actor=actor, target=target, action="deactivate")
    await _ensure_not_last_active_super_admin(db, target)

    now = datetime.now(UTC)
    target.is_active = False
    target.deactivated_at = target.deactivated_at or now
    await _create_audit_log(
        db,
        actor=actor,
        action="USER_DEACTIVATED",
        target_type="user",
        target_id=target.id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata={"email": target.email, "role": target.role},
    )
    await db.commit()
    return await get_user_detail(db, target.id)


async def reactivate_user(
    db: AsyncSession,
    *,
    actor: User,
    user_id: UUID,
    reason: str,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    target = await _get_user_or_404(db, user_id)
    _ensure_reason(reason)
    _ensure_actor_can_reactivate(actor=actor, target=target)

    target.is_active = True
    target.deactivated_at = None
    target.deleted_at = None
    await _create_audit_log(
        db,
        actor=actor,
        action="USER_REACTIVATED",
        target_type="user",
        target_id=target.id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata={"email": target.email, "role": target.role},
    )
    await db.commit()
    return await get_user_detail(db, target.id)


async def soft_delete_user(
    db: AsyncSession,
    *,
    actor: User,
    user_id: UUID,
    reason: str,
    force: bool = False,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    target = await _get_user_or_404(db, user_id)
    _ensure_reason(reason)
    if force and actor.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can request force delete",
        )
    _ensure_actor_can_manage_lifecycle(actor=actor, target=target, action="delete")
    await _ensure_not_last_active_super_admin(db, target)

    now = datetime.now(UTC)
    target.is_active = False
    target.deactivated_at = target.deactivated_at or now
    target.deleted_at = target.deleted_at or now
    await _create_audit_log(
        db,
        actor=actor,
        action="USER_DELETED",
        target_type="user",
        target_id=target.id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata={"email": target.email, "role": target.role, "force": force},
    )
    await db.commit()
    return await get_user_detail(db, target.id)


async def list_workspaces(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    search: str | None = None,
) -> dict[str, object]:
    page, page_size, offset = _pagination(page=page, page_size=page_size)
    statement = (
        select(
            Workspace.id,
            Workspace.name,
            Workspace.description,
            Workspace.owner_id,
            User.email.label("owner_email"),
            Workspace.created_at,
            Workspace.updated_at,
            func.count(distinct(WorkspaceMember.user_id)).label("member_count"),
            func.count(distinct(Document.id)).label("document_count"),
            func.count(distinct(Conversation.id)).label("conversation_count"),
        )
        .join(User, User.id == Workspace.owner_id)
        .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .outerjoin(Document, Document.workspace_id == Workspace.id)
        .outerjoin(Conversation, Conversation.workspace_id == Workspace.id)
        .group_by(Workspace.id, User.email)
    )
    if search:
        term = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(func.lower(Workspace.name).like(term), func.lower(User.email).like(term))
        )
    total = await _count_statement_rows(db, statement)
    rows = await db.execute(
        statement.order_by(desc(Workspace.updated_at)).offset(offset).limit(page_size)
    )
    return {
        "items": [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "owner_id": row.owner_id,
                "owner_email": row.owner_email,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "member_count": int(row.member_count or 0),
                "document_count": int(row.document_count or 0),
                "conversation_count": int(row.conversation_count or 0),
            }
            for row in rows.all()
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_workspace_detail(db: AsyncSession, workspace_id: UUID) -> dict[str, object]:
    workspace_row = (
        await db.execute(
            select(
                Workspace.id,
                Workspace.name,
                Workspace.description,
                Workspace.owner_id,
                Workspace.created_at,
                Workspace.updated_at,
                User.email.label("owner_email"),
                User.full_name.label("owner_full_name"),
                func.count(distinct(WorkspaceMember.user_id)).label("member_count"),
                func.count(distinct(Document.id)).label("document_count"),
                func.count(distinct(Conversation.id)).label("conversation_count"),
                func.count(distinct(Chunk.id)).label("total_chunks"),
            )
            .join(User, User.id == Workspace.owner_id)
            .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .outerjoin(Document, Document.workspace_id == Workspace.id)
            .outerjoin(Conversation, Conversation.workspace_id == Workspace.id)
            .outerjoin(Chunk, Chunk.workspace_id == Workspace.id)
            .where(Workspace.id == workspace_id)
            .group_by(Workspace.id, User.email, User.full_name)
        )
    ).one_or_none()
    if workspace_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    status_counts = await _document_status_counts(db, workspace_id=workspace_id)
    conversations_count = await _count_where(
        db,
        Conversation.id,
        Conversation.workspace_id == workspace_id,
    )
    latest_document_at = await db.scalar(
        select(func.max(Document.created_at)).where(Document.workspace_id == workspace_id)
    )
    latest_conversation_at = await db.scalar(
        select(func.max(Conversation.updated_at)).where(Conversation.workspace_id == workspace_id)
    )
    latest_activity = _max_datetime(
        workspace_row.updated_at,
        latest_document_at,
        latest_conversation_at,
    )

    return {
        "id": workspace_row.id,
        "name": workspace_row.name,
        "description": workspace_row.description,
        "owner_id": workspace_row.owner_id,
        "owner_email": workspace_row.owner_email,
        "created_at": workspace_row.created_at,
        "updated_at": workspace_row.updated_at,
        "member_count": int(workspace_row.member_count or 0),
        "document_count": int(workspace_row.document_count or 0),
        "conversation_count": int(workspace_row.conversation_count or 0),
        "owner": {
            "id": workspace_row.owner_id,
            "email": workspace_row.owner_email,
            "full_name": workspace_row.owner_full_name,
        },
        "members": await _workspace_members(db, workspace_id),
        "documents": await _workspace_documents(db, workspace_id),
        "conversations_count": conversations_count,
        "latest_activity": latest_activity,
        "total_chunks": int(workspace_row.total_chunks or 0),
        "documents_by_status": status_counts,
    }


async def delete_workspace(
    db: AsyncSession,
    *,
    actor: User,
    workspace_id: UUID,
    reason: str,
    delete_documents: bool = True,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _ensure_reason(reason)

    documents = list(
        (
            await db.scalars(select(Document).where(Document.workspace_id == workspace_id))
        ).all()
    )
    vector_delete_error = await _delete_workspace_vectors(workspace_id)
    file_delete_errors: list[str] = []
    if delete_documents:
        for document in documents:
            document.status = "deleted"
            error = _remove_document_file(document)
            if error:
                file_delete_errors.append(error)

    await _create_audit_log(
        db,
        actor=actor,
        action="WORKSPACE_DELETED",
        target_type="workspace",
        target_id=workspace.id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata={
            "name": workspace.name,
            "owner_id": str(workspace.owner_id),
            "delete_documents": delete_documents,
            "documents_deleted": len(documents) if delete_documents else 0,
            "file_delete_errors": file_delete_errors,
            "vector_delete_error": vector_delete_error,
        },
    )
    await db.delete(workspace)
    await db.commit()
    return {
        "id": workspace_id,
        "deleted": True,
        "documents_deleted": len(documents) if delete_documents else 0,
        "vectors_delete_attempted": True,
        "vector_delete_error": vector_delete_error,
    }


async def list_documents(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    search: str | None = None,
    document_status: str | None = None,
) -> dict[str, object]:
    page, page_size, offset = _pagination(page=page, page_size=page_size)
    statement = _document_summary_statement()
    statement = _apply_document_filters(
        statement,
        search=search,
        document_status=document_status,
    )
    total = await _count_statement_rows(db, statement)
    rows = await db.execute(
        statement.order_by(desc(Document.created_at)).offset(offset).limit(page_size)
    )
    return {
        "items": [_document_row_to_summary(row) for row in rows.all()],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_document_detail(db: AsyncSession, document_id: UUID) -> dict[str, object]:
    row = (await db.execute(_document_summary_statement().where(Document.id == document_id))).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    summary = _document_row_to_summary(row)
    workspace = await get_workspace_summary(db, row.workspace_id)
    uploader = None
    if row.uploaded_by is not None:
        uploader_row = await db.get(User, row.uploaded_by)
        if uploader_row is not None:
            uploader = {
                "id": uploader_row.id,
                "email": uploader_row.email,
                "full_name": uploader_row.full_name,
            }
    chunks_count = int(row.chunks_count or 0)
    chunks_with_vector_id = int(row.chunks_with_vector_id or 0)
    summary.update(
        {
            "metadata": {
                "filename": row.filename,
                "file_type": row.file_type,
                "file_size": row.file_size,
                "created_at": row.created_at,
                "processed_at": row.processed_at,
            },
            "workspace": workspace,
            "uploader": uploader,
            "vector_coverage_percent": _coverage_percent(chunks_with_vector_id, chunks_count),
        }
    )
    return summary


async def delete_document(
    db: AsyncSession,
    *,
    actor: User,
    document_id: UUID,
    reason: str,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    document = await db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    _ensure_reason(reason)

    old_status = document.status
    vector_ids = list(
        (
            await db.scalars(
                select(Chunk.vector_id).where(
                    Chunk.document_id == document.id,
                    Chunk.vector_id.is_not(None),
                )
            )
        ).all()
    )
    vector_delete_error = await _delete_vectors_by_ids([str(vector_id) for vector_id in vector_ids])
    file_delete_error = _remove_document_file(document)
    document.status = "deleted"
    await _create_audit_log(
        db,
        actor=actor,
        action="DOCUMENT_DELETED",
        target_type="document",
        target_id=document.id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata={
            "filename": document.filename,
            "workspace_id": str(document.workspace_id),
            "old_status": old_status,
            "vector_count": len(vector_ids),
            "vector_delete_error": vector_delete_error,
            "file_delete_error": file_delete_error,
        },
    )
    await db.commit()
    return await get_document_detail(db, document.id)


async def list_audit_logs(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    actor_user_id: UUID | None = None,
    action: str | None = None,
    target_type: str | None = None,
    target_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict[str, object]:
    page, page_size, offset = _pagination(page=page, page_size=page_size)
    statement = _audit_log_statement()
    if actor_user_id is not None:
        statement = statement.where(AuditLog.actor_user_id == actor_user_id)
    if action:
        statement = statement.where(AuditLog.action == action)
    if target_type:
        statement = statement.where(AuditLog.target_type == target_type)
    if target_id is not None:
        statement = statement.where(AuditLog.target_id == target_id)
    if date_from is not None:
        statement = statement.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        statement = statement.where(AuditLog.created_at <= date_to)

    total = await _count_statement_rows(db, statement)
    rows = await db.execute(
        statement.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    )
    return {
        "items": [_audit_row_to_summary(row) for row in rows.all()],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_documents_stats(db: AsyncSession) -> dict[str, object]:
    stats = await get_stats(db)
    recent_page = await list_documents(db, page=1, page_size=RECENT_LIMIT)
    return {
        "total_documents": stats["total_documents"],
        "documents_by_status": stats["documents_by_status"],
        "total_chunks": stats["total_chunks"],
        "recent_documents": recent_page["items"],
    }


async def get_rag_stats(db: AsyncSession) -> dict[str, object]:
    stats = await get_stats(db)
    return {
        "total_conversations": stats["total_conversations"],
        "total_rag_queries": stats["total_rag_queries"],
        "average_latency_ms": stats["average_latency_ms"],
        "average_faithfulness": stats["average_faithfulness"],
        "average_relevance": stats["average_relevance"],
    }


async def get_usage_stats(db: AsyncSession) -> dict[str, object]:
    stats = await get_stats(db)
    return {
        "prompt_tokens": stats["prompt_tokens"],
        "completion_tokens": stats["completion_tokens"],
        "total_tokens": stats["total_tokens"],
        "estimated_cost_usd": stats["estimated_cost_usd"],
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


async def get_workspace_summary(db: AsyncSession, workspace_id: UUID) -> dict[str, object]:
    page = await list_workspaces(db, page=1, page_size=1)
    for item in page["items"]:
        if item["id"] == workspace_id:
            return item

    row = (
        await db.execute(
            select(
                Workspace.id,
                Workspace.name,
                Workspace.description,
                Workspace.owner_id,
                User.email.label("owner_email"),
                Workspace.created_at,
                Workspace.updated_at,
                func.count(distinct(WorkspaceMember.user_id)).label("member_count"),
                func.count(distinct(Document.id)).label("document_count"),
                func.count(distinct(Conversation.id)).label("conversation_count"),
            )
            .join(User, User.id == Workspace.owner_id)
            .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .outerjoin(Document, Document.workspace_id == Workspace.id)
            .outerjoin(Conversation, Conversation.workspace_id == Workspace.id)
            .where(Workspace.id == workspace_id)
            .group_by(Workspace.id, User.email)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "owner_id": row.owner_id,
        "owner_email": row.owner_email,
        "member_count": int(row.member_count or 0),
        "document_count": int(row.document_count or 0),
        "conversation_count": int(row.conversation_count or 0),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def create_audit_log(
    db: AsyncSession,
    *,
    actor: User | None,
    action: str,
    target_type: str,
    target_id: UUID | None,
    reason: str | None,
    ip_address: str | None,
    user_agent: str | None,
    metadata: dict[str, object] | None = None,
) -> AuditLog:
    return await _create_audit_log(
        db,
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata,
    )


async def _get_user_or_404(db: AsyncSession, user_id: UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _apply_user_filters(
    statement: Any,
    *,
    search: str | None,
    role: str | None,
    is_active: bool | None,
) -> Any:
    if search:
        term = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(func.lower(User.email).like(term), func.lower(User.full_name).like(term))
        )
    if role:
        statement = statement.where(User.role == role)
    if is_active is not None:
        statement = statement.where(User.is_active.is_(is_active))
    return statement


def _document_summary_statement() -> Any:
    return (
        select(
            Document.id,
            Document.workspace_id,
            Workspace.name.label("workspace_name"),
            Document.filename,
            Document.file_type,
            Document.file_size,
            Document.status,
            Document.uploaded_by,
            User.email.label("uploader_email"),
            Document.created_at,
            Document.processed_at,
            func.count(distinct(Chunk.id)).label("chunks_count"),
            func.count(distinct(Chunk.vector_id)).label("chunks_with_vector_id"),
        )
        .join(Workspace, Workspace.id == Document.workspace_id)
        .outerjoin(User, User.id == Document.uploaded_by)
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .group_by(Document.id, Workspace.name, User.email)
    )


def _apply_document_filters(
    statement: Any,
    *,
    search: str | None,
    document_status: str | None,
) -> Any:
    if search:
        term = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(Document.filename).like(term),
                func.lower(Workspace.name).like(term),
                func.lower(User.email).like(term),
            )
        )
    if document_status:
        statement = statement.where(Document.status == document_status)
    return statement


def _document_row_to_summary(row: Any) -> dict[str, object]:
    return {
        "id": row.id,
        "filename": row.filename,
        "file_type": row.file_type,
        "file_size": row.file_size,
        "status": row.status,
        "workspace_id": row.workspace_id,
        "workspace_name": row.workspace_name,
        "uploaded_by": row.uploaded_by,
        "uploader_email": row.uploader_email,
        "created_at": row.created_at,
        "processed_at": row.processed_at,
        "chunks_count": int(row.chunks_count or 0),
        "chunks_with_vector_id": int(row.chunks_with_vector_id or 0),
    }


async def _workspace_members(db: AsyncSession, workspace_id: UUID) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            WorkspaceMember.id,
            WorkspaceMember.user_id,
            User.email,
            User.full_name,
            WorkspaceMember.role,
            WorkspaceMember.created_at,
        )
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at)
    )
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "email": row.email,
            "full_name": row.full_name,
            "role": row.role,
            "joined_at": row.created_at,
        }
        for row in rows.all()
    ]


async def _workspace_documents(db: AsyncSession, workspace_id: UUID) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            Document.id,
            Document.filename,
            Document.file_type,
            Document.file_size,
            Document.status,
            Document.created_at,
            Document.processed_at,
            func.count(distinct(Chunk.id)).label("chunks_count"),
            func.count(distinct(Chunk.vector_id)).label("chunks_with_vector_id"),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .where(Document.workspace_id == workspace_id)
        .group_by(Document.id)
        .order_by(desc(Document.created_at))
        .limit(DETAIL_DOCUMENT_LIMIT)
    )
    return [
        {
            "id": row.id,
            "filename": row.filename,
            "file_type": row.file_type,
            "file_size": row.file_size,
            "status": row.status,
            "created_at": row.created_at,
            "processed_at": row.processed_at,
            "chunks_count": int(row.chunks_count or 0),
            "chunks_with_vector_id": int(row.chunks_with_vector_id or 0),
        }
        for row in rows.all()
    ]


def _audit_log_statement() -> Any:
    return (
        select(
            AuditLog.id,
            AuditLog.actor_user_id,
            User.email.label("actor_email"),
            AuditLog.action,
            AuditLog.target_type,
            AuditLog.target_id,
            AuditLog.reason,
            AuditLog.metadata_.label("metadata_value"),
            AuditLog.ip_address,
            AuditLog.user_agent,
            AuditLog.created_at,
        )
        .outerjoin(User, User.id == AuditLog.actor_user_id)
    )


def _audit_row_to_summary(row: Any) -> dict[str, object]:
    return {
        "id": row.id,
        "actor_user_id": row.actor_user_id,
        "actor_email": row.actor_email,
        "action": row.action,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "reason": row.reason,
        "metadata": row.metadata_value,
        "ip_address": row.ip_address,
        "user_agent": row.user_agent,
        "created_at": row.created_at,
    }


async def _recent_audit_events_for_user(db: AsyncSession, user_id: UUID) -> list[dict[str, object]]:
    if not hasattr(db, "execute"):
        return []
    rows = await db.execute(
        _audit_log_statement()
        .where(AuditLog.target_type == "user", AuditLog.target_id == user_id)
        .order_by(desc(AuditLog.created_at))
        .limit(RECENT_LIMIT)
    )
    return [_audit_row_to_summary(row) for row in rows.all()]


async def _document_status_counts(
    db: AsyncSession,
    *,
    workspace_id: UUID | None = None,
) -> dict[str, int]:
    statement = select(Document.status, func.count(Document.id)).group_by(Document.status)
    if workspace_id is not None:
        statement = statement.where(Document.workspace_id == workspace_id)
    rows = await db.execute(statement.order_by(Document.status))
    counts = {status_name: 0 for status_name in DOCUMENT_STATUSES}
    counts.update({str(document_status): int(count or 0) for document_status, count in rows.all()})
    return counts


def _ensure_reason(reason: str) -> None:
    if not reason or len(reason.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A reason is required",
        )


def _ensure_actor_can_change_role(*, actor: User, target: User, new_role: str) -> None:
    if actor.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role",
        )
    if actor.role != "super_admin" and target.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin users cannot affect super_admin accounts",
        )
    if actor.role != "super_admin" and target.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can manage admin users",
        )
    if actor.role != "super_admin" and new_role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can assign super_admin",
        )


def _ensure_actor_can_manage_lifecycle(*, actor: User, target: User, action: str) -> None:
    if actor.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You cannot {action} your own account",
        )
    if actor.role != "super_admin" and target.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin users cannot affect super_admin accounts",
        )
    if actor.role != "super_admin" and target.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can manage admin users",
        )


def _ensure_actor_can_reactivate(*, actor: User, target: User) -> None:
    if actor.role == "super_admin":
        return
    if target.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can reactivate admin users",
        )


async def _ensure_not_last_active_super_admin(db: AsyncSession, target: User) -> None:
    if target.role != "super_admin" or not target.is_active or target.deleted_at is not None:
        return

    active_super_admins = await _count_where(
        db,
        User.id,
        User.role == "super_admin",
        User.is_active.is_(True),
        User.deleted_at.is_(None),
    )
    if active_super_admins <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one active super_admin is required",
        )


async def _create_audit_log(
    db: AsyncSession,
    *,
    actor: User | None,
    action: str,
    target_type: str,
    target_id: UUID | None,
    reason: str | None,
    ip_address: str | None,
    user_agent: str | None,
    metadata: dict[str, object] | None = None,
) -> AuditLog:
    audit_log = AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_=metadata,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    if hasattr(db, "add"):
        db.add(audit_log)
    return audit_log


async def _delete_workspace_vectors(workspace_id: UUID) -> str | None:
    try:
        await vector_store_service.delete_vectors_by_workspace(workspace_id)
    except Exception as exc:
        return str(exc)
    return None


async def _delete_vectors_by_ids(vector_ids: list[str]) -> str | None:
    if not vector_ids:
        return None
    try:
        await vector_store_service.delete_vectors_by_ids(vector_ids)
    except Exception as exc:
        return str(exc)
    return None


def _remove_document_file(document: Document) -> str | None:
    try:
        storage_path = document_service.resolve_storage_path(document.storage_path)
    except ValueError as exc:
        return str(exc)

    try:
        if storage_path.exists() and storage_path.is_file():
            storage_path.unlink()
        _remove_empty_parent_dirs(storage_path.parent)
    except OSError as exc:
        return str(exc)
    return None


def _remove_empty_parent_dirs(start: Path) -> None:
    storage_root = document_service.STORAGE_ROOT.resolve()
    current = start.resolve()
    while current != storage_root and storage_root in current.parents:
        try:
            current.rmdir()
        except OSError:
            return
        current = current.parent


def _pagination(*, page: int, page_size: int) -> tuple[int, int, int]:
    normalized_page = max(page, 1)
    normalized_page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    return normalized_page, normalized_page_size, (normalized_page - 1) * normalized_page_size


async def _count(db: AsyncSession, column: Any) -> int:
    value = await db.scalar(select(func.count(column)))
    return int(value or 0)


async def _count_where(db: AsyncSession, column: Any, *conditions: Any) -> int:
    statement = select(func.count(column)).where(*conditions)
    value = await db.scalar(statement)
    return int(value or 0)


async def _count_statement_rows(db: AsyncSession, statement: Any) -> int:
    value = await db.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    return int(value or 0)


def _float_or_zero(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _coverage_percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 100.0
    return round((numerator / denominator) * 100, 2)


def _max_datetime(*values: datetime | None) -> datetime | None:
    present_values = [value for value in values if value is not None]
    if not present_values:
        return None
    return max(present_values)
