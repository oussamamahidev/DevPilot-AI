from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import admin as admin_routes
from app.api.routes import rag_traces as rag_traces_routes
from app.api.routes import ragops as ragops_routes
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

    async def fake_list_users(_: object, **__: object) -> list[dict[str, object]]:
        return [
            {
                "id": admin.id,
                "email": admin.email,
                "full_name": admin.full_name,
                "role": admin.role,
                "is_active": admin.is_active,
                "deleted_at": None,
                "deactivated_at": None,
                "last_login_at": None,
                "created_at": admin.created_at,
                "updated_at": admin.updated_at,
                "workspace_count": 2,
                "document_count": 3,
                "conversation_count": 4,
            }
        ]

    monkeypatch.setattr(admin_routes.admin_service, "list_users", fake_list_users)

    response = client.get("/api/v1/admin/users", headers=auth_headers(admin))

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["email"] == "admin@example.com"
    assert data["items"][0]["workspace_count"] == 2


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

    async def fake_list_workspaces(_: object, **__: object) -> list[dict[str, object]]:
        return [
            {
                "id": workspace_id,
                "name": "Engineering",
                "description": None,
                "owner_id": admin.id,
                "owner_email": admin.email,
                "created_at": now,
                "updated_at": now,
                "member_count": 1,
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
                    "file_size": 100,
                    "status": "indexed",
                    "uploaded_by": admin.id,
                    "uploader_email": admin.email,
                    "created_at": now,
                    "processed_at": now,
                        "chunks_count": 2,
                        "chunks_with_vector_id": 2,
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
    assert workspaces.json()["items"][0]["document_count"] == 1
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


def test_admin_can_access_ragops_workspaces(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("ragops-admin@example.com", role="admin")
    state.users[str(admin.id)] = admin
    workspace_id = uuid4()
    now = datetime.now(UTC)

    async def fake_list_workspace_summaries(_: object) -> list[dict[str, object]]:
        return [
            {
                "workspace_id": workspace_id,
                "workspace_name": "Engineering",
                "owner_email": admin.email,
                "documents_total": 2,
                "documents_queued": 0,
                "documents_processing": 0,
                "documents_indexed": 2,
                "documents_failed": 0,
                "documents_deleted": 0,
                "total_chunks": 10,
                "chunks_with_vector_id": 10,
                "chunks_missing_vector_id": 0,
                "embedding_coverage_percent": 100.0,
                "average_chunk_length": 512.0,
                "last_document_uploaded_at": now,
                "last_document_indexed_at": now,
                "average_faithfulness": 0.91,
                "average_hallucination_score": 0.08,
                "rag_health_score": 96,
                "rag_health_status": "healthy",
            }
        ]

    monkeypatch.setattr(
        ragops_routes.ragops_service,
        "list_workspace_summaries",
        fake_list_workspace_summaries,
    )

    response = client.get("/api/v1/admin/ragops/workspaces", headers=auth_headers(admin))

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["workspace_name"] == "Engineering"
    assert data["items"][0]["rag_health_score"] == 96


def test_user_cannot_access_ragops_routes(
    client: TestClient,
    state: AdminRouteState,
) -> None:
    user = make_user("ragops-member@example.com")
    state.users[str(user.id)] = user

    response = client.get("/api/v1/admin/ragops/workspaces", headers=auth_headers(user))

    assert response.status_code == 403
    assert response.json() == {"error": {"message": "Admin access required"}}


def test_super_admin_can_request_full_ragops_chunk_content(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    super_admin = make_user("root@example.com", role="super_admin")
    state.users[str(super_admin.id)] = super_admin
    document_id = uuid4()
    chunk_id = uuid4()
    now = datetime.now(UTC)

    async def fake_list_document_chunks(
        _: object,
        received_document_id: object,
        **kwargs: object,
    ) -> dict[str, object]:
        assert received_document_id == document_id
        assert kwargs["actor"] == super_admin
        assert kwargs["include_content"] is True
        return {
            "document_id": document_id,
            "total": 1,
            "page": kwargs["page"],
            "page_size": kwargs["page_size"],
            "include_content": True,
            "items": [
                {
                    "chunk_id": chunk_id,
                    "chunk_index": 0,
                    "content_preview": "full content",
                    "full_content": "full content",
                    "token_count": 2,
                    "vector_id_exists": True,
                    "metadata": {},
                    "created_at": now,
                }
            ],
        }

    monkeypatch.setattr(
        ragops_routes.ragops_service,
        "list_document_chunks",
        fake_list_document_chunks,
    )

    response = client.get(
        f"/api/v1/admin/ragops/documents/{document_id}/chunks?include_content=true",
        headers=auth_headers(super_admin),
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["full_content"] == "full content"


def test_admin_can_request_ragops_retry_with_reason(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("retry-admin@example.com", role="admin")
    state.users[str(admin.id)] = admin
    document_id = uuid4()

    async def fake_retry_document_processing(
        _: object,
        received_document_id: object,
        **kwargs: object,
    ) -> dict[str, object]:
        assert received_document_id == document_id
        assert kwargs["actor"] == admin
        assert kwargs["reason"] == "retry failed ingestion"
        return {
            "document_id": document_id,
            "status": "queued",
            "task_enqueued": True,
            "audit_action": "DOCUMENT_RETRY_REQUESTED",
        }

    monkeypatch.setattr(
        ragops_routes.ragops_service,
        "retry_document_processing",
        fake_retry_document_processing,
    )

    response = client.post(
        f"/api/v1/admin/ragops/documents/{document_id}/retry",
        headers=auth_headers(admin),
        json={"reason": "retry failed ingestion"},
    )

    assert response.status_code == 200
    assert response.json()["audit_action"] == "DOCUMENT_RETRY_REQUESTED"


def test_admin_can_access_rag_trace_list(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("trace-admin@example.com", role="admin")
    state.users[str(admin.id)] = admin
    workspace_id = uuid4()
    conversation_id = uuid4()
    message_id = uuid4()
    now = datetime.now(UTC)

    async def fake_list_rag_traces(_: object, **kwargs: object) -> dict[str, object]:
        assert kwargs["page"] == 1
        assert kwargs["page_size"] == 10
        return {
            "items": [
                {
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "workspace_id": workspace_id,
                    "workspace_name": "Engineering",
                    "user_id": admin.id,
                    "user_email": "user@example.com",
                    "question_preview": "What is DevPilot?",
                    "answer_preview": "DevPilot is...",
                    "retrieval_strategy": "hybrid",
                    "citation_count": 2,
                    "faithfulness": 0.9,
                    "relevance": 0.8,
                    "context_precision": 0.7,
                    "hallucination_score": 0.1,
                    "corrected": False,
                    "created_at": now,
                    "total_latency_ms": 1234,
                }
            ],
            "page": 1,
            "page_size": 10,
            "total": 1,
        }

    monkeypatch.setattr(
        rag_traces_routes.rag_traces_service,
        "list_rag_traces",
        fake_list_rag_traces,
    )

    response = client.get(
        "/api/v1/admin/rag-traces?page_size=10&search=DevPilot",
        headers=auth_headers(admin),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["retrieval_strategy"] == "hybrid"


def test_user_cannot_access_rag_trace_routes(
    client: TestClient,
    state: AdminRouteState,
) -> None:
    user = make_user("trace-member@example.com")
    state.users[str(user.id)] = user

    response = client.get("/api/v1/admin/rag-traces", headers=auth_headers(user))

    assert response.status_code == 403
    assert response.json() == {"error": {"message": "Admin access required"}}


def test_admin_can_access_rag_trace_detail(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("trace-detail-admin@example.com", role="admin")
    state.users[str(admin.id)] = admin
    workspace_id = uuid4()
    conversation_id = uuid4()
    message_id = uuid4()
    now = datetime.now(UTC)

    async def fake_get_trace_detail(
        _: object,
        received_message_id: object,
        **kwargs: object,
    ) -> dict[str, object]:
        assert received_message_id == message_id
        assert kwargs["actor"] == admin
        assert kwargs["include_content"] is False
        return {
            "message_id": message_id,
            "conversation_id": conversation_id,
            "workspace": {"id": workspace_id, "name": "Engineering"},
            "user": {"id": admin.id, "email": admin.email, "full_name": admin.full_name},
            "question": "What is indexed?",
            "answer": "The guide is indexed [1].",
            "retrieval_strategy": "hybrid",
            "citations": [],
            "retrieved_chunks": [],
            "evaluation": {
                "faithfulness": 0.9,
                "relevance": 0.8,
                "context_precision": 0.7,
                "hallucination_score": 0.1,
                "explanation": "Looks supported.",
                "evaluation_method": "llm",
                "corrected": False,
                "correction_reason": None,
            },
            "agent_runs": [
                {
                    "id": uuid4(),
                    "agent_type": "retrieval",
                    "status": "completed",
                    "latency_ms": 20,
                    "input_preview": {},
                    "output_preview": {},
                    "error": None,
                    "created_at": now,
                }
            ],
            "latency_summary": {"total_latency_ms": 20, "by_agent_type": {"retrieval": 20}},
            "corrector_decision": {
                "corrected": False,
                "correction_applied": False,
                "reason": None,
                "generated_answer_preview": "The guide is indexed [1].",
                "final_answer_preview": "The guide is indexed [1].",
            },
        }

    monkeypatch.setattr(
        rag_traces_routes.rag_traces_service,
        "get_trace_detail",
        fake_get_trace_detail,
    )

    response = client.get(f"/api/v1/admin/rag-traces/{message_id}", headers=auth_headers(admin))

    assert response.status_code == 200
    assert response.json()["question"] == "What is indexed?"


def test_admin_can_access_rag_trace_quality_summary(
    client: TestClient,
    state: AdminRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = make_user("quality-admin@example.com", role="admin")
    state.users[str(admin.id)] = admin

    async def fake_quality_summary(_: object) -> dict[str, object]:
        return {
            "total_rag_queries": 1,
            "average_faithfulness": 0.9,
            "average_relevance": 0.8,
            "average_context_precision": 0.7,
            "average_hallucination_score": 0.1,
            "low_quality_count": 0,
            "hallucination_risk_count": 0,
            "no_context_count": 0,
            "corrected_answers_count": 0,
            "average_latency_by_agent": {"generator": 100.0},
            "worst_messages_by_hallucination": [],
            "worst_messages_by_relevance": [],
        }

    monkeypatch.setattr(
        rag_traces_routes.rag_traces_service,
        "get_quality_summary",
        fake_quality_summary,
    )

    response = client.get(
        "/api/v1/admin/rag-traces/quality/summary",
        headers=auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json()["average_latency_by_agent"]["generator"] == 100.0
