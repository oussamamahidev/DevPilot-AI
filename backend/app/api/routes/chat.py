from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_active_user
from app.api.dependencies.workspaces import get_workspace_or_403
from app.core.exceptions import AppException
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.user import User
from app.models.workspace import Workspace
from app.providers.base import EmbeddingProviderError, LLMProviderError
from app.schemas.chat import (
    ChatQueryRequest,
    ChatQueryResponse,
    ConversationDetailResponse,
    ConversationSummaryResponse,
    MessageEvaluationResponse,
)
from app.services import chat_service, evaluation_service, workspace_service
from app.services.vector_store_service import VectorStoreError


router = APIRouter(tags=["chat"])


@router.post(
    "/workspaces/{workspace_id}/chat/query",
    response_model=ChatQueryResponse,
)
async def query_workspace_chat(
    workspace_id: UUID,
    payload: ChatQueryRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
) -> dict[str, object]:
    _ = workspace_id
    try:
        return await chat_service.query_chat(
            db=db,
            workspace=workspace,
            user=current_user,
            question=payload.question,
            conversation_id=payload.conversation_id,
        )
    except chat_service.ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied",
        ) from exc
    except (EmbeddingProviderError, LLMProviderError, VectorStoreError) as exc:
        raise AppException(
            message=str(exc),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from exc


@router.get(
    "/workspaces/{workspace_id}/conversations",
    response_model=list[ConversationSummaryResponse],
)
async def list_workspace_conversations(
    workspace_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
) -> list[Conversation]:
    _ = workspace_id
    return await chat_service.list_workspace_conversations(
        db=db,
        workspace_id=workspace.id,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
async def get_conversation(
    conversation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict[str, object]:
    workspace_id = await chat_service.get_conversation_workspace_id(
        db=db,
        conversation_id=conversation_id,
    )
    if workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied",
        )

    if current_user.role != "admin":
        member = await workspace_service.get_workspace_member(
            db=db,
            workspace_id=workspace_id,
            user_id=current_user.id,
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied",
            )

    try:
        return await chat_service.get_conversation_detail(
            db=db,
            conversation_id=conversation_id,
            workspace_id=workspace_id,
        )
    except chat_service.ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied",
        ) from exc


@router.get(
    "/messages/{message_id}/evaluation",
    response_model=MessageEvaluationResponse,
)
async def get_message_evaluation(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> object:
    try:
        return await evaluation_service.get_message_evaluation(
            db=db,
            message_id=message_id,
            user_id=current_user.id,
            is_admin=current_user.role == "admin",
        )
    except evaluation_service.EvaluationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found or access denied",
        ) from exc
