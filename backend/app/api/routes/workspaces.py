from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_active_user
from app.api.dependencies.workspaces import get_workspace_or_403, require_workspace_role
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from app.services import workspace_service


router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Workspace:
    return await workspace_service.create_workspace(
        db=db,
        payload=payload,
        owner=current_user,
    )


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> list[Workspace]:
    return await workspace_service.list_workspaces_for_user(db=db, user=current_user)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
) -> Workspace:
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    workspace: Annotated[Workspace, Depends(require_workspace_role("owner"))],
) -> Workspace:
    _ = workspace_id
    return await workspace_service.update_workspace(
        db=db,
        workspace=workspace,
        payload=payload,
    )


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    workspace: Annotated[Workspace, Depends(require_workspace_role("owner"))],
) -> Response:
    _ = workspace_id
    await workspace_service.delete_workspace(db=db, workspace=workspace)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
