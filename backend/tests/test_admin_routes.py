from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import admin as admin_routes
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.user import User


@dataclass
class AdminRouteState:
    users: dict[str, User] = field(default_factory=dict)


class FakeAdminSession:
    def __init__(self, state: AdminRouteState) -> None:
        self.state = state

    async def scalar(self, statement: object) -> object | None:
        criteria: dict[str, object] = {}
        for criterion in getattr(statement, "_where_criteria", ()):
            field_name = getattr(getattr(criterion, "left", None), "name", None)
            field_value = getattr(getattr(criterion, "right", None), "value", None)
            if field_name is not None:
                criteria[field_name] = field_value
        return self.state.users.get(str(criteria.get("id")))


@pytest.fixture
def state() -> AdminRouteState:
    return AdminRouteState()


@pytest.fixture
def client(state: AdminRouteState) -> TestClient:
    async def override_get_db() -> AsyncGenerator[FakeAdminSession, None]:
        yield FakeAdminSession(state)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def make_user(email: str, role: str = "user") -> User:
    return User(
        id=uuid4(),
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="not-used",
        role=role,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_access_users(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("admin@example.com", role="admin")
    state.users[str(admin.id)] = admin

    async def fake_list_users(_: object) -> list[dict[str, object]]:
        return [
            {
                "id": admin.id,
                "email": admin.email,
                "full_name": admin.full_name,
                "role": admin.role,
                "is_active": admin.is_active,
                "created_at": admin.created_at,
                "workspace_count": 2,
                "document_count": 3,
                "conversation_count": 4,
            }
        ]

    monkeypatch.setattr(admin_routes.admin_service, "list_users", fake_list_users)

    response = client.get("/api/v1/admin/users", headers=auth_headers(admin))

    assert response.status_code == 200
    data = response.json()
    assert data[0]["email"] == "admin@example.com"
    assert data[0]["workspace_count"] == 2


def test_user_cannot_access_admin_routes(
    client: TestClient,
    state: AdminRouteState,
) -> None:
    user = make_user("member@example.com")
    state.users[str(user.id)] = user

    response = client.get("/api/v1/admin/users", headers=auth_headers(user))

    assert response.status_code == 403
    assert response.json() == {"error": {"message": "Admin access required"}}


def test_admin_stats_return_expected_shape(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("stats-admin@example.com", role="admin")
    state.users[str(admin.id)] = admin
    workspace_id = uuid4()
    document_id = uuid4()
    message_id = uuid4()
    now = datetime.now(UTC)

    async def fake_list_workspaces(_: object) -> list[dict[str, object]]:
        return [
            {
                "id": workspace_id,
                "name": "Engineering",
                "owner_id": admin.id,
                "owner_email": admin.email,
                "created_at": now,
                "updated_at": now,
                "document_count": 1,
                "conversation_count": 1,
            }
        ]

    async def fake_documents_stats(_: object) -> dict[str, object]:
        return {
            "total_documents": 1,
            "documents_by_status": {"indexed": 1},
            "total_chunks": 2,
            "recent_documents": [
                {
                    "id": document_id,
                    "workspace_id": workspace_id,
                    "workspace_name": "Engineering",
                    "filename": "guide.txt",
                    "file_type": "txt",
                    "status": "indexed",
                    "uploaded_by": admin.id,
                    "uploader_email": admin.email,
                    "created_at": now,
                    "processed_at": now,
                }
            ],
        }

    async def fake_rag_stats(_: object) -> dict[str, object]:
        return {
            "total_conversations": 1,
            "total_rag_queries": 1,
            "average_latency_ms": 123.4,
            "average_faithfulness": 0.9,
            "average_relevance": 0.8,
        }

    async def fake_usage_stats(_: object) -> dict[str, object]:
        return {
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150,
            "estimated_cost_usd": 0.001,
        }

    async def fake_errors(_: object) -> dict[str, object]:
        return {
            "errors": [
                {
                    "id": uuid4(),
                    "source": "agent_run",
                    "message": "generator failed",
                    "status": "failed",
                    "created_at": now,
                    "context": {"message_id": str(message_id)},
                }
            ]
        }

    monkeypatch.setattr(admin_routes.admin_service, "list_workspaces", fake_list_workspaces)
    monkeypatch.setattr(admin_routes.admin_service, "get_documents_stats", fake_documents_stats)
    monkeypatch.setattr(admin_routes.admin_service, "get_rag_stats", fake_rag_stats)
    monkeypatch.setattr(admin_routes.admin_service, "get_usage_stats", fake_usage_stats)
    monkeypatch.setattr(admin_routes.admin_service, "list_errors", fake_errors)

    headers = auth_headers(admin)

    workspaces = client.get("/api/v1/admin/workspaces", headers=headers)
    documents = client.get("/api/v1/admin/documents/stats", headers=headers)
    rag = client.get("/api/v1/admin/rag/stats", headers=headers)
    usage = client.get("/api/v1/admin/usage/stats", headers=headers)
    errors = client.get("/api/v1/admin/errors", headers=headers)

    assert workspaces.status_code == 200
    assert workspaces.json()[0]["document_count"] == 1
    assert documents.status_code == 200
    assert documents.json()["documents_by_status"] == {"indexed": 1}
    assert documents.json()["recent_documents"][0]["filename"] == "guide.txt"
    assert rag.status_code == 200
    assert set(rag.json()) == {
        "total_conversations",
        "total_rag_queries",
        "average_latency_ms",
        "average_faithfulness",
        "average_relevance",
    }
    assert usage.status_code == 200
    assert usage.json()["total_tokens"] == 150
    assert errors.status_code == 200
    assert errors.json()["errors"][0]["source"] == "agent_run"
