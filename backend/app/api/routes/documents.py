from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_active_user
from app.api.dependencies.documents import get_document_or_403
from app.api.dependencies.workspaces import get_workspace_or_403
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.document import DocumentResponse, DocumentStatusResponse
from app.services import document_service


router = APIRouter(tags=["documents"])


@router.post(
    "/workspaces/{workspace_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    workspace_id: UUID,
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
) -> Document:
    _ = workspace_id
    return await document_service.upload_document(
        db=db,
        workspace=workspace,
        uploader=current_user,
        upload_file=file,
    )


@router.get(
    "/workspaces/{workspace_id}/documents",
    response_model=list[DocumentResponse],
)
async def list_documents(
    workspace_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
) -> list[Document]:
    _ = workspace_id
    return await document_service.list_documents_for_workspace(
        db=db,
        workspace_id=workspace.id,
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document: Annotated[Document, Depends(get_document_or_403)],
) -> Document:
    return document


@router.get("/documents/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document: Annotated[Document, Depends(get_document_or_403)],
) -> DocumentStatusResponse:
    return DocumentStatusResponse(id=document.id, status=document.status)


@router.delete("/documents/{document_id}", response_model=DocumentResponse)
async def delete_document(
    db: Annotated[AsyncSession, Depends(get_db)],
    document: Annotated[Document, Depends(get_document_or_403)],
) -> Document:
    return await document_service.mark_document_deleted(db=db, document=document)
