from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import retrieval as retrieval_routes
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


@dataclass
class RetrievalRouteState:
    users: dict[str, User] = field(default_factory=dict)
    workspaces: dict[str, Workspace] = field(default_factory=dict)
    members: dict[str, WorkspaceMember] = field(default_factory=dict)


class FakeRetrievalRouteSession:
    def __init__(self, state: RetrievalRouteState) -> None:
        self.state = state

    async def scalar(self, statement: object) -> object | None:
        target = self._target_entity(statement)
        criteria = self._criteria(statement)

        if target is User:
            return self.state.users.get(str(criteria.get("id")))

        if target is Workspace:
            workspace = self.state.workspaces.get(str(criteria.get("id")))
            if workspace is not None:
                workspace.members = [
                    member
                    for member in self.state.members.values()
                    if member.workspace_id == workspace.id
                ]
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


@pytest.fixture
def state() -> RetrievalRouteState:
    return RetrievalRouteState()


@pytest.fixture
def client(state: RetrievalRouteState) -> TestClient:
    async def override_get_db() -> AsyncGenerator[FakeRetrievalRouteSession, None]:
        yield FakeRetrievalRouteSession(state)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def make_user(email: str) -> User:
    return User(
        id=uuid4(),
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="not-used",
        role="user",
        is_active=True,
    )


def make_workspace(state: RetrievalRouteState, owner: User) -> Workspace:
    workspace = Workspace(
        id=uuid4(),
        name="Retrieval Workspace",
        description=None,
        owner_id=owner.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    member = WorkspaceMember(
        id=uuid4(),
        workspace_id=workspace.id,
        user_id=owner.id,
        role="owner",
        created_at=datetime.now(UTC),
    )
    state.workspaces[str(workspace.id)] = workspace
    state.members[str(member.id)] = member
    return workspace


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def test_workspace_member_can_search_retrieval(
    client: TestClient,
    state: RetrievalRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = make_user("owner-retrieval@example.com")
    state.users[str(user.id)] = user
    workspace = make_workspace(state, user)
    chunk_id = uuid4()
    document_id = uuid4()
    calls: list[dict[str, object]] = []

    async def fake_retrieve_semantic(**kwargs: object) -> list[dict[str, object]]:
        calls.append(kwargs)
        return [
            {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "filename": "guide.txt",
                "content": "DevPilot AI content",
                "chunk_index": 0,
                "score": 0.88,
                "metadata": {"start_char": 0, "end_char": 19},
            }
        ]

    monkeypatch.setattr(retrieval_routes, "retrieve_semantic", fake_retrieve_semantic)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/retrieval/search",
        headers=auth_headers(user),
        json={"query": "What is DevPilot AI?", "top_k": 3},
    )

    assert response.status_code == 200
    assert response.json()[0]["chunk_id"] == str(chunk_id)
    assert response.json()[0]["score"] == 0.88
    assert calls[0]["workspace_id"] == workspace.id
    assert calls[0]["query"] == "What is DevPilot AI?"
    assert calls[0]["top_k"] == 3


def test_non_member_cannot_search_workspace_retrieval(
    client: TestClient,
    state: RetrievalRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = make_user("owner2-retrieval@example.com")
    other_user = make_user("other-retrieval@example.com")
    state.users[str(owner.id)] = owner
    state.users[str(other_user.id)] = other_user
    workspace = make_workspace(state, owner)
    calls: list[dict[str, object]] = []

    async def fake_retrieve_semantic(**kwargs: object) -> list[dict[str, object]]:
        calls.append(kwargs)
        return []

    monkeypatch.setattr(retrieval_routes, "retrieve_semantic", fake_retrieve_semantic)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/retrieval/search",
        headers=auth_headers(other_user),
        json={"query": "What is DevPilot AI?", "top_k": 3},
    )

    assert response.status_code == 403
    assert calls == []
