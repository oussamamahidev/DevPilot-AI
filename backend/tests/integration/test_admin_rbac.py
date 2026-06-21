from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.audit import AuditLog
from app.models.user import User
from app.services import admin_service


@dataclass
class RouteState:
    users: dict[str, User] = field(default_factory=dict)


class RouteSession:
    def __init__(self, state: RouteState) -> None:
        self.state = state

    async def scalar(self, statement: object) -> object | None:
        criteria: dict[str, object] = {}
        for criterion in getattr(statement, "_where_criteria", ()):
            field_name = getattr(getattr(criterion, "left", None), "name", None)
            field_value = getattr(getattr(criterion, "right", None), "value", None)
            if field_name is not None:
                criteria[field_name] = field_value
        return self.state.users.get(str(criteria.get("id")))


class RbacSession:
    def __init__(self, users: list[User]) -> None:
        self.users = {user.id: user for user in users}
        self.added: list[object] = []
        self.commits = 0

    async def get(self, model: object, object_id: UUID) -> object | None:
        if model is User:
            return self.users.get(object_id)
        return None

    def add(self, item: object) -> None:
        self.added.append(item)

    async def commit(self) -> None:
        self.commits += 1


@pytest.fixture
def route_state() -> RouteState:
    return RouteState()


@pytest.fixture
def client(route_state: RouteState) -> TestClient:
    async def override_get_db() -> AsyncGenerator[RouteSession, None]:
        yield RouteSession(route_state)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def make_user(email: str, role: str = "user", is_active: bool = True) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="not-exposed",
        role=role,
        is_active=is_active,
        deleted_at=None,
        deactivated_at=None,
        last_login_at=None,
        created_at=now,
        updated_at=now,
    )


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


async def zero_count(*_: object, **__: object) -> int:
    return 0


def user_detail(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "deleted_at": user.deleted_at,
        "deactivated_at": user.deactivated_at,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "workspace_count": 0,
        "owned_workspace_count": 0,
        "document_count": 0,
        "conversation_count": 0,
    }


def test_normal_user_cannot_access_admin_routes(
    client: TestClient,
    route_state: RouteState,
) -> None:
    user = make_user("member@example.com")
    route_state.users[str(user.id)] = user

    response = client.get("/api/v1/admin/stats", headers=auth_headers(user))

    assert response.status_code == 403


def test_admin_can_list_users(
    client: TestClient,
    route_state: RouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("admin@example.com", role="admin")
    member = make_user("member@example.com")
    route_state.users[str(admin.id)] = admin

    async def fake_list_users(*_: object, **__: object) -> list[dict[str, object]]:
        return [user_detail(member)]

    monkeypatch.setattr(admin_service, "list_users", fake_list_users)

    response = client.get("/api/v1/admin/users", headers=auth_headers(admin))

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["email"] == "member@example.com"
    assert "password_hash" not in response.text


@pytest.mark.asyncio
async def test_admin_cannot_manage_super_admin() -> None:
    admin = make_user("admin@example.com", role="admin")
    super_admin = make_user("root@example.com", role="super_admin")
    db = RbacSession([admin, super_admin])

    with pytest.raises(HTTPException) as exc_info:
        await admin_service.change_user_role(
            db,  # type: ignore[arg-type]
            actor=admin,
            user_id=super_admin.id,
            new_role="user",
            reason="security review",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )

    assert exc_info.value.status_code == 403
    assert super_admin.role == "super_admin"


@pytest.mark.asyncio
async def test_super_admin_can_promote_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    super_admin = make_user("root@example.com", role="super_admin")
    member = make_user("member@example.com")
    db = RbacSession([super_admin, member])
    monkeypatch.setattr(admin_service, "_count_where", zero_count)

    result = await admin_service.change_user_role(
        db,  # type: ignore[arg-type]
        actor=super_admin,
        user_id=member.id,
        new_role="admin",
        reason="approved access request",
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    assert result["role"] == "admin"
    assert member.role == "admin"


@pytest.mark.asyncio
async def test_cannot_deactivate_last_active_super_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor = make_user("root-2@example.com", role="super_admin")
    target = make_user("root@example.com", role="super_admin")
    db = RbacSession([actor, target])

    async def one_active_super_admin(*_: object, **__: object) -> int:
        return 1

    monkeypatch.setattr(admin_service, "_count_where", one_active_super_admin)

    with pytest.raises(HTTPException) as exc_info:
        await admin_service.deactivate_user(
            db,  # type: ignore[arg-type]
            actor=actor,
            user_id=target.id,
            reason="rotation",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )

    assert exc_info.value.status_code == 400
    assert target.is_active is True


@pytest.mark.asyncio
async def test_dangerous_actions_create_audit_logs(monkeypatch: pytest.MonkeyPatch) -> None:
    super_admin = make_user("root@example.com", role="super_admin")
    member = make_user("member@example.com")
    db = RbacSession([super_admin, member])
    monkeypatch.setattr(admin_service, "_count_where", zero_count)

    await admin_service.change_user_role(
        db,  # type: ignore[arg-type]
        actor=super_admin,
        user_id=member.id,
        new_role="admin",
        reason="team lead promotion",
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    audit_logs = [item for item in db.added if isinstance(item, AuditLog)]
    assert len(audit_logs) == 1
    assert audit_logs[0].action == "USER_ROLE_CHANGED"
    assert audit_logs[0].reason == "team lead promotion"


def test_no_admin_response_exposes_secrets(
    client: TestClient,
    route_state: RouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("admin@example.com", role="admin")
    route_state.users[str(admin.id)] = admin

    async def fake_stats(_: object) -> dict[str, object]:
        return {
            "total_users": 1,
            "active_users": 1,
            "inactive_users": 0,
            "deleted_users": 0,
            "users_by_role": {"admin": 1},
            "total_workspaces": 0,
            "total_documents": 0,
            "documents_by_status": {},
            "total_chunks": 0,
            "total_conversations": 0,
            "total_rag_queries": 0,
            "average_latency_ms": 0.0,
            "average_faithfulness": 0.0,
            "average_relevance": 0.0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0.0,
        }

    monkeypatch.setattr(admin_service, "get_stats", fake_stats)

    response = client.get("/api/v1/admin/stats", headers=auth_headers(admin))

    assert response.status_code == 200
    lowered = response.text.lower()
    assert "password_hash" not in lowered
    assert "secret_key" not in lowered
    assert "gemini_api_key" not in lowered
    assert "database_url" not in lowered
