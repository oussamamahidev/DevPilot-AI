from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminAuditLogsPage,
    AdminDeleteResponse,
    AdminDocumentDetail,
    AdminDocumentsPage,
    AdminDocumentsStats,
    AdminErrorsResponse,
    AdminRagStats,
    AdminStatsResponse,
    AdminUsageStats,
    AdminUserDetail,
    AdminUsersPage,
    AdminWorkspaceDetail,
    AdminWorkspacesPage,
    ReasonRequest,
    UserDeleteRequest,
    UserRoleUpdateRequest,
    WorkspaceDeleteRequest,
)
from app.services import admin_service


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    stats = await admin_service.get_stats(db)
    stats = _normalize_stats_response(stats)
    await admin_service.create_audit_log(
        db,
        actor=actor,
        action="ADMIN_STATS_VIEWED",
        target_type="system",
        target_id=None,
        reason=None,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=None,
    )
    if hasattr(db, "commit"):
        await db.commit()
    return stats


@router.get("/users", response_model=AdminUsersPage)
async def list_admin_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = admin_service.DEFAULT_PAGE_SIZE,
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
) -> dict[str, object]:
    result = await admin_service.list_users(
        db,
        page=page,
        page_size=page_size,
        search=search,
        role=role,
        is_active=is_active,
    )
    if isinstance(result, list):
        return {"items": result, "total": len(result), "page": page, "page_size": page_size}
    return result


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_admin_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_user_detail(db, user_id)


@router.patch("/users/{user_id}/role", response_model=AdminUserDetail)
async def update_admin_user_role(
    user_id: UUID,
    payload: UserRoleUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await admin_service.change_user_role(
        db,
        actor=actor,
        user_id=user_id,
        new_role=payload.role,
        reason=payload.reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch("/users/{user_id}/deactivate", response_model=AdminUserDetail)
async def deactivate_admin_user(
    user_id: UUID,
    payload: ReasonRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await admin_service.deactivate_user(
        db,
        actor=actor,
        user_id=user_id,
        reason=payload.reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch("/users/{user_id}/reactivate", response_model=AdminUserDetail)
async def reactivate_admin_user(
    user_id: UUID,
    payload: ReasonRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await admin_service.reactivate_user(
        db,
        actor=actor,
        user_id=user_id,
        reason=payload.reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.delete("/users/{user_id}", response_model=AdminUserDetail)
async def delete_admin_user(
    user_id: UUID,
    payload: UserDeleteRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await admin_service.soft_delete_user(
        db,
        actor=actor,
        user_id=user_id,
        reason=payload.reason,
        force=payload.force,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/workspaces", response_model=AdminWorkspacesPage)
async def list_admin_workspaces(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = admin_service.DEFAULT_PAGE_SIZE,
    search: str | None = None,
) -> dict[str, object]:
    result = await admin_service.list_workspaces(
        db,
        page=page,
        page_size=page_size,
        search=search,
    )
    if isinstance(result, list):
        return {"items": result, "total": len(result), "page": page, "page_size": page_size}
    return result


@router.get("/workspaces/{workspace_id}", response_model=AdminWorkspaceDetail)
async def get_admin_workspace(
    workspace_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_workspace_detail(db, workspace_id)


@router.delete("/workspaces/{workspace_id}", response_model=AdminDeleteResponse)
async def delete_admin_workspace(
    workspace_id: UUID,
    payload: WorkspaceDeleteRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await admin_service.delete_workspace(
        db,
        actor=actor,
        workspace_id=workspace_id,
        reason=payload.reason,
        delete_documents=payload.delete_documents,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/documents", response_model=AdminDocumentsPage)
async def list_admin_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = admin_service.DEFAULT_PAGE_SIZE,
    search: str | None = None,
    status_: Annotated[str | None, Query(alias="status")] = None,
) -> dict[str, object]:
    result = await admin_service.list_documents(
        db,
        page=page,
        page_size=page_size,
        search=search,
        document_status=status_,
    )
    if isinstance(result, list):
        return {"items": result, "total": len(result), "page": page, "page_size": page_size}
    return result


@router.get("/documents/stats", response_model=AdminDocumentsStats)
async def get_admin_documents_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_documents_stats(db)


@router.get("/documents/{document_id}", response_model=AdminDocumentDetail)
async def get_admin_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_document_detail(db, document_id)


@router.delete("/documents/{document_id}", response_model=AdminDocumentDetail)
async def delete_admin_document(
    document_id: UUID,
    payload: ReasonRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await admin_service.delete_document(
        db,
        actor=actor,
        document_id=document_id,
        reason=payload.reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/audit-logs", response_model=AdminAuditLogsPage)
async def list_admin_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = admin_service.DEFAULT_PAGE_SIZE,
    actor_user_id: UUID | None = None,
    action: str | None = None,
    target_type: str | None = None,
    target_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict[str, object]:
    result = await admin_service.list_audit_logs(
        db,
        page=page,
        page_size=page_size,
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        date_from=date_from,
        date_to=date_to,
    )
    if isinstance(result, list):
        return {"items": result, "total": len(result), "page": page, "page_size": page_size}
    return result


@router.get("/rag/stats", response_model=AdminRagStats)
async def get_admin_rag_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_rag_stats(db)


@router.get("/usage/stats", response_model=AdminUsageStats)
async def get_admin_usage_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_usage_stats(db)


@router.get("/errors", response_model=AdminErrorsResponse)
async def list_admin_errors(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.list_errors(db)


def _request_context(request: Request) -> tuple[str | None, str | None]:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",", 1)[0].strip() if forwarded_for else None
    if ip_address is None and request.client is not None:
        ip_address = request.client.host
    return ip_address, request.headers.get("user-agent")


def _normalize_stats_response(stats: dict[str, object]) -> dict[str, object]:
    if {"users", "workspaces", "documents", "rag", "agents"}.issubset(stats):
        return stats

    documents_by_status = stats.get("documents_by_status")
    if not isinstance(documents_by_status, dict):
        documents_by_status = {}
    users_by_role = stats.get("users_by_role")
    if not isinstance(users_by_role, dict):
        users_by_role = {}

    stats.update(
        {
            "users": {
                "total": int(stats.get("total_users") or 0),
                "active": int(stats.get("active_users") or 0),
                "inactive": int(stats.get("inactive_users") or 0),
                "deleted": int(stats.get("deleted_users") or 0),
                "admins": int(users_by_role.get("admin") or 0),
                "super_admins": int(users_by_role.get("super_admin") or 0),
            },
            "workspaces": {"total": int(stats.get("total_workspaces") or 0)},
            "documents": {
                "total": int(stats.get("total_documents") or 0),
                "indexed": int(documents_by_status.get("indexed") or 0),
                "queued": int(documents_by_status.get("queued") or 0),
                "processing": int(documents_by_status.get("processing") or 0),
                "failed": int(documents_by_status.get("failed") or 0),
                "deleted": int(documents_by_status.get("deleted") or 0),
            },
            "rag": {
                "conversations": int(stats.get("total_conversations") or 0),
                "messages": 0,
                "evaluations": 0,
                "retrieved_chunks": 0,
            },
            "agents": {
                "runs": 0,
                "avg_latency_ms_by_agent": {},
            },
        }
    )
    return stats
