from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.workspaces import get_workspace_or_403
from app.core.exceptions import AppException
from app.db.session import get_db
from app.models.workspace import Workspace
from app.providers.base import EmbeddingProviderError
from app.schemas.retrieval import RetrievalRequest, RetrievedChunkResponse
from app.services.retrieval_service import retrieve_chunks
from app.services.vector_store_service import VectorStoreError


router = APIRouter(tags=["retrieval"])


@router.post(
    "/workspaces/{workspace_id}/retrieval/search",
    response_model=list[RetrievedChunkResponse],
)
async def search_retrieval(
    workspace_id: UUID,
    payload: RetrievalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
) -> list[dict[str, object]]:
    _ = workspace_id
    try:
        return await retrieve_chunks(
            db=db,
            workspace_id=workspace.id,
            query=payload.query,
            top_k=payload.top_k,
            strategy=payload.strategy,
        )
    except (EmbeddingProviderError, VectorStoreError) as exc:
        raise AppException(
            message=str(exc),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from exc
