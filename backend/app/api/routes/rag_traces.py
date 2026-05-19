from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.rag_traces import (
    RagTraceDetail,
    RagTraceEvaluationDetails,
    RagTraceListResponse,
    RagTraceQualitySummary,
    RagTraceRerankingDetails,
    RagTraceRetrievalDetails,
)
from app.services import rag_traces_service


router = APIRouter(prefix="/admin/rag-traces", tags=["admin-rag-traces"])


@router.get("", response_model=RagTraceListResponse)
async def list_rag_traces(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
    workspace_id: UUID | None = None,
    user_id: UUID | None = None,
    retrieval_strategy: str | None = None,
    min_faithfulness: Annotated[float | None, Query(ge=0, le=1)] = None,
    max_hallucination_score: Annotated[float | None, Query(ge=0, le=1)] = None,
    has_citations: bool | None = None,
    corrected: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    limit: Annotated[
        int,
        Query(ge=1, le=rag_traces_service.TRACE_MAX_LIMIT),
    ] = rag_traces_service.TRACE_LIST_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, object]:
    return await rag_traces_service.list_rag_traces(
        db,
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
        limit=limit,
        offset=offset,
    )


@router.get("/quality/summary", response_model=RagTraceQualitySummary)
async def get_rag_trace_quality_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await rag_traces_service.get_quality_summary(db)


@router.get("/{message_id}", response_model=RagTraceDetail)
async def get_rag_trace(
    message_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
    include_content: Annotated[bool, Query()] = False,
) -> dict[str, object]:
    ip_address, user_agent = _request_context(request)
    return await rag_traces_service.get_trace_detail(
        db,
        message_id,
        actor=actor,
        include_content=include_content,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/{message_id}/retrieval", response_model=RagTraceRetrievalDetails)
async def get_rag_trace_retrieval(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
    include_content: Annotated[bool, Query()] = False,
) -> dict[str, object]:
    return await rag_traces_service.get_retrieval_details(
        db,
        message_id,
        actor=actor,
        include_content=include_content,
    )


@router.get("/{message_id}/reranking", response_model=RagTraceRerankingDetails)
async def get_rag_trace_reranking(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
    include_content: Annotated[bool, Query()] = False,
) -> dict[str, object]:
    return await rag_traces_service.get_reranking_details(
        db,
        message_id,
        actor=actor,
        include_content=include_content,
    )


@router.get("/{message_id}/evaluation", response_model=RagTraceEvaluationDetails)
async def get_rag_trace_evaluation(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
) -> dict[str, object]:
    return await rag_traces_service.get_evaluation_details(db, message_id)


def _request_context(request: Request) -> tuple[str | None, str | None]:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",", 1)[0].strip() if forwarded_for else None
    if ip_address is None and request.client is not None:
        ip_address = request.client.host
    return ip_address, request.headers.get("user-agent")
