from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.ragops import (
    RagOpsChunksResponse,
    RagOpsDocumentPipeline,
    RagOpsQdrantHealth,
    RagOpsRetryRequest,
    RagOpsRetryResponse,
    RagOpsWorkspaceDetail,
    RagOpsWorkspaceSummary,
)
from app.services import ragops_service


router = APIRouter(prefix="/admin/ragops", tags=["admin-ragops"])


@router.get("/workspaces", response_model=list[RagOpsWorkspaceSummary])
async def list_ragops_workspaces(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> list[dict[str, object]]:
    return await ragops_service.list_workspace_summaries(db)


@router.get("/workspaces/{workspace_id}", response_model=RagOpsWorkspaceDetail)
async def get_ragops_workspace(
    workspace_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await ragops_service.get_workspace_detail(db, workspace_id)


@router.get("/documents/{document_id}/pipeline", response_model=RagOpsDocumentPipeline)
async def get_ragops_document_pipeline(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await ragops_service.get_document_pipeline(db, document_id)


@router.get("/documents/{document_id}/chunks", response_model=RagOpsChunksResponse)
async def list_ragops_document_chunks(
    document_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
    include_content: Annotated[bool, Query()] = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await ragops_service.list_document_chunks(
        db,
        document_id,
        actor=actor,
        include_content=include_content,
        limit=limit,
        offset=offset,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post("/documents/{document_id}/retry", response_model=RagOpsRetryResponse)
async def retry_ragops_document(
    document_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
    payload: Annotated[RagOpsRetryRequest, Body()],
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await ragops_service.retry_document_processing(
        db,
        document_id,
        actor=actor,
        reason=payload.reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/qdrant/health", response_model=RagOpsQdrantHealth)
async def get_ragops_qdrant_health(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await ragops_service.get_qdrant_health(db)


def _request_context(request: Request) -> tuple[str | None, str | None]:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",", 1)[0].strip() if forwarded_for else None
    if ip_address is None and request.client is not None:
        ip_address = request.client.host
    return ip_address, request.headers.get("user-agent")
