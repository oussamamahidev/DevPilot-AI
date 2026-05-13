from collections.abc import Callable, Coroutine
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.services import workspace_service


async def get_workspace_or_403(
    workspace_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Workspace:
    workspace = await workspace_service.get_workspace_for_user(
        db=db,
        workspace_id=workspace_id,
        user=current_user,
    )
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace not found or access denied",
        )
    return workspace


def require_workspace_role(
    *allowed_roles: str,
) -> Callable[..., Coroutine[Any, Any, Workspace]]:
    async def dependency(
        workspace: Annotated[Workspace, Depends(get_workspace_or_403)],
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> Workspace:
        if current_user.role == "admin":
            return workspace

        member = await workspace_service.get_workspace_member(
            db=db,
            workspace_id=workspace.id,
            user_id=current_user.id,
        )
        if member is None or member.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient workspace permissions",
            )
        return workspace

    return dependency
