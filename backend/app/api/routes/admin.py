from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminDocumentsStats,
    AdminErrorsResponse,
    AdminRagStats,
    AdminUsageStats,
    AdminUserSummary,
    AdminWorkspaceSummary,
)
from app.services import admin_service


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserSummary])
async def list_admin_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> list[dict[str, object]]:
    return await admin_service.list_users(db)


@router.get("/workspaces", response_model=list[AdminWorkspaceSummary])
async def list_admin_workspaces(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> list[dict[str, object]]:
    return await admin_service.list_workspaces(db)


@router.get("/documents/stats", response_model=AdminDocumentsStats)
async def get_admin_documents_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await admin_service.get_documents_stats(db)


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
