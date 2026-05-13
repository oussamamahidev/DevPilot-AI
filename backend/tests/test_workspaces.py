from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


class FakeScalarResult:
    def __init__(self, items: list[Workspace]) -> None:
        self.items = items

    def unique(self) -> "FakeScalarResult":
        return self

    def all(self) -> list[Workspace]:
        return self.items


@dataclass
class WorkspaceState:
    users: dict[str, User] = field(default_factory=dict)
    workspaces: dict[str, Workspace] = field(default_factory=dict)
    members: dict[str, WorkspaceMember] = field(default_factory=dict)


class FakeWorkspaceSession:
    def __init__(self, state: WorkspaceState) -> None:
        self.state = state
        self.pending: list[object] = []

    async def scalar(self, statement: object) -> object | None:
        target = self._target_entity(statement)
        criteria = self._criteria(statement)

        if target is User:
            return self.state.users.get(str(criteria.get("id")))

        if target is Workspace:
            workspace = self.state.workspaces.get(str(criteria.get("id")))
            if workspace is not None:
                self._hydrate_workspace(workspace)
            return workspace

        if target is WorkspaceMember:
            return next(
                (
                    member
                    for member in self.state.members.values()
                    if str(member.workspace_id) == str(criteria.get("workspace_id"))
                    and str(member.user_id) == str(criteria.get("user_id"))
                ),
                None,
            )

        return None

    async def scalars(self, statement: object) -> FakeScalarResult:
        target = self._target_entity(statement)
        criteria = self._criteria(statement)
        if target is not Workspace:
            return FakeScalarResult([])

        user_id = criteria.get("user_id")
        workspace_ids = {
            str(member.workspace_id)
            for member in self.state.members.values()
            if str(member.user_id) == str(user_id)
        }
        workspaces = [
            workspace
            for workspace_id, workspace in self.state.workspaces.items()
            if workspace_id in workspace_ids
        ]
        for workspace in workspaces:
            self._hydrate_workspace(workspace)
        return FakeScalarResult(workspaces)

    def add(self, instance: object) -> None:
        self.pending.append(instance)

    async def commit(self) -> None:
        now = datetime.now(UTC)
        for instance in self.pending:
            if isinstance(instance, Workspace):
                if instance.id is None:
                    instance.id = uuid4()
                if instance.created_at is None:
                    instance.created_at = now
                instance.updated_at = now
                self.state.workspaces[str(instance.id)] = instance
            elif isinstance(instance, WorkspaceMember):
                if instance.id is None:
                    instance.id = uuid4()
                if instance.created_at is None:
                    instance.created_at = now
                self.state.members[str(instance.id)] = instance

        for workspace in self.state.workspaces.values():
            if workspace.updated_at is None:
                workspace.updated_at = now
        self.pending.clear()

    async def delete(self, instance: object) -> None:
        if isinstance(instance, Workspace):
            self.state.workspaces.pop(str(instance.id), None)
            for member_id, member in list(self.state.members.items()):
                if member.workspace_id == instance.id:
                    self.state.members.pop(member_id, None)

    @staticmethod
    def _target_entity(statement: object) -> object | None:
        descriptions = getattr(statement, "column_descriptions", [])
        if not descriptions:
            return None
        return descriptions[0].get("entity")

    @staticmethod
    def _criteria(statement: object) -> dict[str, object]:
        criteria: dict[str, object] = {}
        for criterion in getattr(statement, "_where_criteria", ()):
            field_name = getattr(getattr(criterion, "left", None), "name", None)
            field_value = getattr(getattr(criterion, "right", None), "value", None)
            if field_name is not None:
                criteria[field_name] = field_value
        return criteria

    def _hydrate_workspace(self, workspace: Workspace) -> None:
        workspace.members = [
            member
            for member in self.state.members.values()
            if member.workspace_id == workspace.id
        ]


@pytest.fixture
def state() -> WorkspaceState:
    return WorkspaceState()


@pytest.fixture
def users(state: WorkspaceState) -> tuple[User, User]:
    first_user = make_user("ada@example.com")
    second_user = make_user("grace@example.com")
    state.users[str(first_user.id)] = first_user
    state.users[str(second_user.id)] = second_user
    return first_user, second_user


@pytest.fixture
def client(state: WorkspaceState) -> TestClient:
    async def override_get_db() -> AsyncGenerator[FakeWorkspaceSession, None]:
        yield FakeWorkspaceSession(state)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def make_user(email: str, role: str = "user") -> User:
    user = User(
        id=uuid4(),
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="not-used",
        role=role,
        is_active=True,
    )
    return user


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def create_workspace(
    client: TestClient,
    user: User,
    name: str = "Engineering",
) -> dict[str, object]:
    response = client.post(
        "/api/v1/workspaces",
        json={"name": name, "description": "Private docs"},
        headers=auth_headers(user),
    )
    assert response.status_code == 201
    return response.json()


def add_workspace_member(
    state: WorkspaceState,
    workspace_id: UUID | str,
    user: User,
    role: str = "member",
) -> None:
    member = WorkspaceMember(
        id=uuid4(),
        workspace_id=UUID(str(workspace_id)),
        user_id=user.id,
        role=role,
        created_at=datetime.now(UTC),
    )
    state.members[str(member.id)] = member


def test_create_workspace(client: TestClient, users: tuple[User, User]) -> None:
    owner, _ = users

    response = client.post(
        "/api/v1/workspaces",
        json={"name": "Engineering", "description": "Private docs"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Engineering"
    assert data["description"] == "Private docs"
    assert data["owner_id"] == str(owner.id)
    assert data["members"][0]["user_id"] == str(owner.id)
    assert data["members"][0]["role"] == "owner"


def test_list_own_workspaces(client: TestClient, users: tuple[User, User]) -> None:
    first_user, second_user = users
    first_workspace = create_workspace(client, first_user, name="First")
    create_workspace(client, second_user, name="Second")

    response = client.get("/api/v1/workspaces", headers=auth_headers(first_user))

    assert response.status_code == 200
    data = response.json()
    assert [workspace["id"] for workspace in data] == [first_workspace["id"]]


def test_cannot_access_another_user_workspace(
    client: TestClient,
    users: tuple[User, User],
) -> None:
    first_user, second_user = users
    workspace = create_workspace(client, first_user)

    response = client.get(
        f"/api/v1/workspaces/{workspace['id']}",
        headers=auth_headers(second_user),
    )

    assert response.status_code == 403
    assert response.json() == {
        "error": {"message": "Workspace not found or access denied"}
    }


def test_owner_can_update(client: TestClient, users: tuple[User, User]) -> None:
    owner, _ = users
    workspace = create_workspace(client, owner)

    response = client.patch(
        f"/api/v1/workspaces/{workspace['id']}",
        json={"name": "Updated Engineering"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Engineering"


def test_non_owner_cannot_update(
    client: TestClient,
    state: WorkspaceState,
    users: tuple[User, User],
) -> None:
    owner, member = users
    workspace = create_workspace(client, owner)
    add_workspace_member(state, workspace["id"], member, role="member")

    response = client.patch(
        f"/api/v1/workspaces/{workspace['id']}",
        json={"name": "Unauthorized Update"},
        headers=auth_headers(member),
    )

    assert response.status_code == 403
    assert response.json() == {
        "error": {"message": "Insufficient workspace permissions"}
    }
