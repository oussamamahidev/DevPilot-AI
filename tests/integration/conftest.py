from __future__ import annotations

import json
import os
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_URL = os.getenv("DEVPILOT_BACKEND_URL", "http://localhost:8000").rstrip("/")
API_BASE_URL = os.getenv("DEVPILOT_API_BASE", f"{BACKEND_URL}/api/v1").rstrip("/")
FRONTEND_URL = os.getenv("DEVPILOT_FRONTEND_URL", "http://localhost:3001").rstrip("/")
OLLAMA_URL = os.getenv("DEVPILOT_OLLAMA_URL", "http://localhost:11434").rstrip("/")
QDRANT_URL = os.getenv("DEVPILOT_QDRANT_URL", "http://localhost:6335").rstrip("/")
RUN_INGESTION = os.getenv("DEVPILOT_RUN_INGESTION") == "1"
RUN_RAG = os.getenv("DEVPILOT_RUN_RAG") == "1"


@dataclass(frozen=True)
class TestUser:
    email: str
    password: str
    token: str
    user_id: str


@dataclass(frozen=True)
class TestWorkspace:
    id: str
    name: str


@dataclass(frozen=True)
class TestDocument:
    id: str
    filename: str


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    _ = config
    skip_ingestion = pytest.mark.skip(
        reason="set DEVPILOT_RUN_INGESTION=1 to run ingestion/Qdrant/Ollama tests"
    )
    skip_rag = pytest.mark.skip(
        reason="set DEVPILOT_RUN_RAG=1 to run generation/chat/evaluation tests"
    )

    for item in items:
        keywords = item.keywords
        if "ingestion" in keywords and not RUN_INGESTION:
            item.add_marker(skip_ingestion)
        if "rag" in keywords and not RUN_RAG:
            item.add_marker(skip_rag)


@pytest.fixture(scope="session")
def http_client() -> httpx.Client:
    with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        yield client


@pytest.fixture(scope="session")
def api_base_url() -> str:
    return API_BASE_URL


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


@pytest.fixture(scope="session")
def frontend_url() -> str:
    return FRONTEND_URL


def unique_suffix() -> str:
    return f"{int(time.time() * 1000)}"


def require_status(response: httpx.Response, expected_status: int | set[int]) -> None:
    expected = {expected_status} if isinstance(expected_status, int) else expected_status
    assert response.status_code in expected, (
        f"Expected {expected}, got {response.status_code}: {response.text[:500]}"
    )


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_user(
    client: httpx.Client,
    api_base: str,
    *,
    email_prefix: str = "integration",
) -> TestUser:
    email = f"{email_prefix}-{unique_suffix()}@example.com"
    password = "devpilot-password-123"
    response = client.post(
        f"{api_base}/auth/register",
        json={
            "email": email,
            "full_name": f"{email_prefix.title()} User",
            "password": password,
        },
    )
    require_status(response, {200, 201})
    user_payload = response.json()
    assert user_payload["email"] == email
    assert "password" not in user_payload
    assert "password_hash" not in user_payload

    login_response = client.post(
        f"{api_base}/auth/login",
        json={"email": email, "password": password},
    )
    require_status(login_response, 200)
    token = login_response.json().get("access_token")
    assert isinstance(token, str)
    assert token.startswith("eyJ")

    return TestUser(
        email=email,
        password=password,
        token=token,
        user_id=str(user_payload["id"]),
    )


@pytest.fixture
def registered_user(http_client: httpx.Client, api_base_url: str) -> TestUser:
    return register_user(http_client, api_base_url)


def create_workspace(
    client: httpx.Client,
    api_base: str,
    token: str,
    *,
    name: str | None = None,
) -> TestWorkspace:
    response = client.post(
        f"{api_base}/workspaces",
        headers=auth_headers(token),
        json={
            "name": name or f"Integration Workspace {unique_suffix()}",
            "description": "Workspace created by live integration tests",
        },
    )
    require_status(response, {200, 201})
    payload = response.json()
    return TestWorkspace(id=str(payload["id"]), name=str(payload["name"]))


@pytest.fixture
def workspace(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user: TestUser,
) -> TestWorkspace:
    return create_workspace(http_client, api_base_url, registered_user.token)


def upload_text_document(
    client: httpx.Client,
    api_base: str,
    token: str,
    workspace_id: str,
    *,
    filename: str,
    content: str,
) -> TestDocument:
    response = client.post(
        f"{api_base}/workspaces/{workspace_id}/documents",
        headers=auth_headers(token),
        files={"file": (filename, content.encode("utf-8"), "text/plain")},
    )
    require_status(response, {200, 201})
    payload = response.json()
    assert payload["filename"] == filename
    return TestDocument(id=str(payload["id"]), filename=filename)


def wait_for_document_status(
    client: httpx.Client,
    api_base: str,
    token: str,
    document_id: str,
    *,
    expected_status: str = "indexed",
    timeout_seconds: int = 180,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_payload: dict[str, Any] = {}
    while time.monotonic() < deadline:
        response = client.get(
            f"{api_base}/documents/{document_id}/status",
            headers=auth_headers(token),
        )
        require_status(response, 200)
        last_payload = response.json()
        if last_payload.get("status") == expected_status:
            return last_payload
        if last_payload.get("status") == "failed":
            pytest.fail(f"Document processing failed: {last_payload}")
        time.sleep(3)

    pytest.fail(
        f"Document {document_id} did not reach {expected_status}. Last payload: {last_payload}"
    )


@pytest.fixture
def indexed_document(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user: TestUser,
    workspace: TestWorkspace,
) -> TestDocument:
    document = upload_text_document(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        filename=f"phase-ingestion-{unique_suffix()}.txt",
        content=(
            "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Qdrant, "
            "Ollama embeddings, hybrid retrieval, reranking, Gemini generation, "
            "citations, and answer evaluation. Celery processes documents in the "
            "background while Redis acts as the queue broker."
        ),
    )
    wait_for_document_status(
        http_client,
        api_base_url,
        registered_user.token,
        document.id,
    )
    return document


def run_command(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=PROJECT_ROOT,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def docker_compose(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run_command(["docker", "compose", *args], check=check)


def psql(query: str) -> str:
    result = docker_compose(
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        os.getenv("POSTGRES_USER", "devpilot"),
        "-d",
        os.getenv("POSTGRES_DB", "devpilot"),
        "-tA",
        "-c",
        query,
    )
    return result.stdout.strip()


def psql_json(query: str) -> Any:
    output = psql(query)
    assert output, "Expected SQL query to return JSON"
    return json.loads(output)
