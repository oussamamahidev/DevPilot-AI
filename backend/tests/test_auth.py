from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import get_db
from app.main import app
from app.models.user import User


class FakeAuthSession:
    def __init__(self, users: dict[str, User]) -> None:
        self.users = users
        self.pending: list[User] = []

    async def scalar(self, statement: object) -> User | None:
        whereclause = getattr(statement, "whereclause", None)
        field_name = getattr(getattr(whereclause, "left", None), "name", None)
        field_value = getattr(getattr(whereclause, "right", None), "value", None)

        if field_name == "email":
            return next(
                (user for user in self.users.values() if user.email == field_value),
                None,
            )
        if field_name == "id":
            return self.users.get(str(field_value))
        return None

    def add(self, user: User) -> None:
        self.pending.append(user)

    async def commit(self) -> None:
        for user in self.pending:
            if any(existing.email == user.email for existing in self.users.values()):
                raise IntegrityError("duplicate user email", {}, Exception())
            if user.id is None:
                user.id = uuid4()
            self.users[str(user.id)] = user
        self.pending.clear()

    async def rollback(self) -> None:
        self.pending.clear()

    async def refresh(self, _: User) -> None:
        return None


@pytest.fixture
def users() -> dict[str, User]:
    return {}


@pytest.fixture
def client(users: dict[str, User]) -> TestClient:
    async def override_get_db() -> AsyncGenerator[FakeAuthSession, None]:
        yield FakeAuthSession(users)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def registration_payload(email: str = "ada@example.com") -> dict[str, str]:
    return {
        "email": email,
        "full_name": "Ada Lovelace",
        "password": "secure-password",
    }


def register_user(client: TestClient, email: str = "ada@example.com") -> dict[str, object]:
    response = client.post("/api/v1/auth/register", json=registration_payload(email))
    assert response.status_code == 201
    return response.json()


def login_user(client: TestClient, email: str = "ada@example.com") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "secure-password"},
    )
    assert response.status_code == 200
    return str(response.json()["access_token"])


def test_register_success(client: TestClient) -> None:
    response = client.post("/api/v1/auth/register", json=registration_payload())

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "ada@example.com"
    assert data["full_name"] == "Ada Lovelace"
    assert data["role"] == "user"
    assert data["is_active"] is True
    assert data["id"]
    assert "password_hash" not in data


def test_duplicate_email(client: TestClient) -> None:
    register_user(client)
    response = client.post("/api/v1/auth/register", json=registration_payload())

    assert response.status_code == 409
    assert response.json() == {"error": {"message": "Email is already registered"}}


def test_login_success(client: TestClient) -> None:
    registered_user = register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "secure-password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]

    token_payload = jwt.decode(
        data["access_token"],
        settings.secret_key,
        algorithms=[ALGORITHM],
    )
    assert token_payload["sub"] == registered_user["id"]
    assert token_payload["email"] == "ada@example.com"
    assert token_payload["role"] == "user"
    assert "exp" in token_payload


def test_wrong_password(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": {"message": "Invalid email or password"}}


def test_me_with_valid_token(client: TestClient) -> None:
    register_user(client)
    access_token = login_user(client)

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "ada@example.com"
    assert data["role"] == "user"
    assert "password_hash" not in data


def test_me_without_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json() == {"error": {"message": "Not authenticated"}}
