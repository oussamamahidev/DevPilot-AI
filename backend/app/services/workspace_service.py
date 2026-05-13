from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


async def create_workspace(
    db: AsyncSession,
    payload: WorkspaceCreate,
    owner: User,
) -> Workspace:
    workspace = Workspace(
        id=uuid4(),
        name=payload.name,
        description=payload.description,
        owner_id=owner.id,
    )
    member = WorkspaceMember(
        id=uuid4(),
        workspace_id=workspace.id,
        user_id=owner.id,
        role="owner",
    )

    db.add(workspace)
    db.add(member)
    await db.commit()

    created_workspace = await get_workspace_by_id(db, workspace.id)
    if created_workspace is None:
        raise RuntimeError("Created workspace could not be loaded")
    return created_workspace


async def list_workspaces_for_user(db: AsyncSession, user: User) -> list[Workspace]:
    result = await db.scalars(
        select(Workspace)
        .join(WorkspaceMember)
        .where(WorkspaceMember.user_id == user.id)
        .options(selectinload(Workspace.members))
        .order_by(Workspace.created_at.desc())
    )
    return list(result.unique().all())


async def get_workspace_by_id(db: AsyncSession, workspace_id: UUID) -> Workspace | None:
    return await db.scalar(
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .options(selectinload(Workspace.members))
    )


async def get_workspace_member(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceMember | None:
    return await db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )


async def get_workspace_for_user(
    db: AsyncSession,
    workspace_id: UUID,
    user: User,
) -> Workspace | None:
    workspace = await get_workspace_by_id(db, workspace_id)
    if workspace is None:
        return None

    if user.role == "admin":
        return workspace

    member = await get_workspace_member(db, workspace_id, user.id)
    if member is None:
        return None

    return workspace


async def update_workspace(
    db: AsyncSession,
    workspace: Workspace,
    payload: WorkspaceUpdate,
) -> Workspace:
    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data:
        workspace.name = update_data["name"]
    if "description" in update_data:
        workspace.description = update_data["description"]

    await db.commit()

    updated_workspace = await get_workspace_by_id(db, workspace.id)
    if updated_workspace is None:
        raise RuntimeError("Updated workspace could not be loaded")
    return updated_workspace


async def delete_workspace(db: AsyncSession, workspace: Workspace) -> None:
    await db.delete(workspace)
    await db.commit()
