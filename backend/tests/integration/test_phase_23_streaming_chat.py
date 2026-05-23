from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import chat as chat_routes
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    LLMUsage,
    Message,
    RetrievedChunk,
)
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.providers.base import LLMProviderError, LLMResponse
from app.services import chat_service


@dataclass
class ChatRouteState:
    users: dict[str, User] = field(default_factory=dict)
    workspaces: dict[str, Workspace] = field(default_factory=dict)
    members: dict[str, WorkspaceMember] = field(default_factory=dict)


class FakeChatRouteSession:
    def __init__(self, state: ChatRouteState) -> None:
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


class FakeChatSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits = 0
        self.rollbacks = 0

    def add(self, instance: object) -> None:
        self.added.append(instance)

    async def flush(self) -> None:
        now = datetime.now(UTC)
        for instance in self.added:
            if getattr(instance, "id", None) is None:
                instance.id = uuid4()
            if isinstance(instance, Conversation):
                if instance.created_at is None:
                    instance.created_at = now
                if instance.updated_at is None:
                    instance.updated_at = now
            if isinstance(instance, (Message, RetrievedChunk, LLMUsage, Evaluation, AgentRun)):
                if instance.created_at is None:
                    instance.created_at = now

    async def commit(self) -> None:
        await self.flush()
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def scalar(self, statement: object) -> object | None:
        _ = statement
        return None


class StreamingLLMProvider:
    model = "stream-test-model"

    async def stream_generate(self, prompt: str, system_prompt: str) -> AsyncGenerator[str, None]:
        assert "Context:" in prompt
        assert "private-document assistant" in system_prompt
        yield "DevPilot AI uses "
        yield "FastAPI and Qdrant."

    async def generate(self, prompt: str, system_prompt: str) -> LLMResponse:
        _ = prompt, system_prompt
        return LLMResponse(content="fallback", model=self.model)


class FailingStreamingLLMProvider:
    model = "stream-failure-model"

    async def stream_generate(self, prompt: str, system_prompt: str) -> AsyncGenerator[str, None]:
        _ = prompt, system_prompt
        raise LLMProviderError("Provider unavailable. Please retry.")
        yield ""


@pytest.fixture
def route_state() -> ChatRouteState:
    return ChatRouteState()


@pytest.fixture
def client(route_state: ChatRouteState) -> TestClient:
    async def override_get_db() -> AsyncGenerator[FakeChatRouteSession, None]:
        yield FakeChatRouteSession(route_state)

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    if original_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = original_override


def make_user(email: str, role: str = "user") -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="not-used",
        role=role,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def make_workspace(state: ChatRouteState, owner: User) -> Workspace:
    now = datetime.now(UTC)
    workspace = Workspace(
        id=uuid4(),
        name="Streaming Workspace",
        description=None,
        owner_id=owner.id,
        created_at=now,
        updated_at=now,
    )
    member = WorkspaceMember(
        id=uuid4(),
        workspace_id=workspace.id,
        user_id=owner.id,
        role="owner",
        created_at=now,
    )
    state.workspaces[str(workspace.id)] = workspace
    state.members[str(member.id)] = member
    return workspace


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def fake_stream_events(
    workspace: Workspace,
    conversation_id: UUID,
    message_id: UUID,
):
    async def stream_events(**kwargs: object) -> AsyncGenerator[tuple[str, dict[str, object]], None]:
        assert kwargs["workspace"] == workspace
        assert kwargs["question"] == "What is DevPilot AI?"
        yield (
            "start",
            {
                "workspace_id": str(workspace.id),
                "conversation_id": str(conversation_id),
                "retrieval_strategy": "hybrid",
            },
        )
        yield ("trace", {"stage": "query_rewriter", "status": "started"})
        yield ("trace", {"stage": "retrieval", "status": "completed", "retrieved_count": 1})
        yield ("token", {"text": "DevPilot AI uses FastAPI [1]."})
        yield (
            "citations",
            {
                "citations": [
                    {
                        "id": 1,
                        "document_id": str(uuid4()),
                        "filename": "streaming.txt",
                        "chunk_id": str(uuid4()),
                        "chunk_index": 0,
                        "score": 0.9,
                    }
                ]
            },
        )
        yield (
            "evaluation",
            {
                "evaluation": {
                    "faithfulness": 0.9,
                    "relevance": 1.0,
                    "context_precision": 0.8,
                    "hallucination_score": 0.1,
                    "explanation": "Grounded answer.",
                }
            },
        )
        yield (
            "message",
            {
                "message_id": str(message_id),
                "conversation_id": str(conversation_id),
            },
        )
        yield ("done", {"status": "completed"})

    return stream_events


def stream_response_text(
    client: TestClient,
    state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> str:
    user = make_user("stream-owner@example.com")
    state.users[str(user.id)] = user
    workspace = make_workspace(state, user)
    monkeypatch.setattr(
        chat_routes.chat_service,
        "stream_chat_events",
        fake_stream_events(workspace, uuid4(), uuid4()),
    )

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/chat/stream",
        headers=auth_headers(user),
        json={"question": "What is DevPilot AI?", "retrieval_strategy": "hybrid"},
    )

    assert response.status_code == 200
    return response.text


async def fake_retrieve_chunks(**kwargs: object) -> list[dict[str, object]]:
    assert kwargs["strategy"] == "hybrid"
    chunk_id = uuid4()
    document_id = uuid4()
    return [
        {
            "chunk_id": chunk_id,
            "document_id": document_id,
            "filename": "streaming.txt",
            "content": "DevPilot AI uses FastAPI and Qdrant for RAG.",
            "chunk_index": 0,
            "score": 0.92,
            "metadata": {"source_scores": {"semantic": 0.92, "keyword": 0.4}},
        }
    ]


async def fake_rerank(**kwargs: object) -> list[dict[str, object]]:
    return list(kwargs["contexts"])  # type: ignore[arg-type]


async def fake_evaluate_answer(**kwargs: object) -> dict[str, object]:
    assert kwargs["answer"].endswith("[1].")
    return {
        "faithfulness": 0.9,
        "relevance": 1.0,
        "context_precision": 0.8,
        "hallucination_score": 0.1,
        "explanation": "Answer is grounded.",
    }


async def collect_service_stream(
    monkeypatch: pytest.MonkeyPatch,
    *,
    provider: object | None = None,
) -> tuple[FakeChatSession, list[tuple[str, dict[str, object]]]]:
    workspace = Workspace(
        id=uuid4(),
        name="Streaming Service Workspace",
        description=None,
        owner_id=uuid4(),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    user = make_user("stream-service@example.com")
    session = FakeChatSession()

    monkeypatch.setattr(chat_service, "retrieve_chunks", fake_retrieve_chunks)
    monkeypatch.setattr(chat_service, "rerank", fake_rerank)
    monkeypatch.setattr(chat_service, "evaluate_answer", fake_evaluate_answer)
    monkeypatch.setattr(
        chat_service,
        "get_llm_provider",
        lambda: provider if provider is not None else StreamingLLMProvider(),
    )

    events = [
        event
        async for event in chat_service.stream_chat_events(
            db=session,  # type: ignore[arg-type]
            workspace=workspace,
            user=user,
            question="What is DevPilot AI?",
            retrieval_strategy="hybrid",
        )
    ]
    return session, events


def test_unauthenticated_stream_request_returns_401(client: TestClient) -> None:
    response = client.post(
        f"/api/v1/workspaces/{uuid4()}/chat/stream",
        json={"question": "What is DevPilot AI?"},
    )

    assert response.status_code == 401


def test_user_cannot_stream_chat_in_workspace_they_do_not_own(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = make_user("owner@example.com")
    other_user = make_user("other@example.com")
    route_state.users[str(owner.id)] = owner
    route_state.users[str(other_user.id)] = other_user
    workspace = make_workspace(route_state, owner)
    calls: list[object] = []

    async def fake_events(**kwargs: object) -> AsyncGenerator[tuple[str, dict[str, object]], None]:
        calls.append(kwargs)
        yield ("done", {"status": "completed"})

    monkeypatch.setattr(chat_routes.chat_service, "stream_chat_events", fake_events)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/chat/stream",
        headers=auth_headers(other_user),
        json={"question": "What is DevPilot AI?"},
    )

    assert response.status_code == 403
    assert calls == []


def test_valid_stream_request_returns_text_event_stream(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = make_user("stream-valid@example.com")
    route_state.users[str(user.id)] = user
    workspace = make_workspace(route_state, user)
    monkeypatch.setattr(
        chat_routes.chat_service,
        "stream_chat_events",
        fake_stream_events(workspace, uuid4(), uuid4()),
    )

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/chat/stream",
        headers=auth_headers(user),
        json={"question": "What is DevPilot AI?"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")


def test_stream_emits_start_event(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: start" in body


def test_stream_emits_trace_events(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: trace" in body
    assert '"stage": "retrieval"' in body


def test_stream_emits_token_events(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: token" in body
    assert "DevPilot AI uses FastAPI" in body


def test_stream_emits_citations_event(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: citations" in body
    assert "streaming.txt" in body


def test_stream_emits_evaluation_event(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: evaluation" in body
    assert '"faithfulness": 0.9' in body


def test_stream_emits_message_event(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: message" in body
    assert "message_id" in body


def test_stream_emits_done_event(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = stream_response_text(client, route_state, monkeypatch)
    assert "event: done" in body
    assert '"status": "completed"' in body


@pytest.mark.asyncio
async def test_streaming_assistant_message_is_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    session, events = await collect_service_stream(monkeypatch)
    messages = [item for item in session.added if isinstance(item, Message)]

    assert any(event_name == "done" for event_name, _ in events)
    assert len(messages) == 2
    assert messages[1].role == "assistant"
    assert messages[1].content == "DevPilot AI uses FastAPI and Qdrant [1]."


@pytest.mark.asyncio
async def test_streaming_retrieved_chunks_are_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    session, _ = await collect_service_stream(monkeypatch)
    retrieved_chunks = [item for item in session.added if isinstance(item, RetrievedChunk)]

    assert len(retrieved_chunks) == 1
    assert retrieved_chunks[0].rank == 1
    assert retrieved_chunks[0].retrieval_strategy == "hybrid"


@pytest.mark.asyncio
async def test_streaming_evaluation_is_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    session, events = await collect_service_stream(monkeypatch)
    evaluations = [item for item in session.added if isinstance(item, Evaluation)]

    assert any(event_name == "evaluation" for event_name, _ in events)
    assert len(evaluations) == 1
    assert evaluations[0].faithfulness == 0.9
    assert evaluations[0].explanation == "Answer is grounded."


@pytest.mark.asyncio
async def test_streaming_agent_runs_are_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    session, _ = await collect_service_stream(monkeypatch)
    agent_runs = [item for item in session.added if isinstance(item, AgentRun)]

    assert [agent_run.agent_type for agent_run in agent_runs] == [
        "router",
        "query_rewriter",
        "retrieval",
        "reranker",
        "generator",
        "evaluator",
        "corrector",
    ]
    assert all(agent_run.status == "completed" for agent_run in agent_runs)


@pytest.mark.asyncio
async def test_provider_failure_emits_clean_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    session, events = await collect_service_stream(
        monkeypatch,
        provider=FailingStreamingLLMProvider(),
    )

    assert events[-1] == ("error", {"message": "Provider unavailable. Please retry."})
    assert session.rollbacks == 1
    assert "GEMINI_API_KEY" not in str(events)
    assert "SECRET_KEY" not in str(events)


def test_chat_query_still_works(
    client: TestClient,
    route_state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = make_user("query-still-works@example.com")
    route_state.users[str(user.id)] = user
    workspace = make_workspace(route_state, user)

    async def fake_query_chat(**kwargs: object) -> dict[str, object]:
        assert kwargs["workspace"] == workspace
        return {
            "answer": "DevPilot AI uses FastAPI [1].",
            "citations": [],
            "conversation_id": uuid4(),
            "message_id": uuid4(),
            "evaluation": {
                "faithfulness": 0.9,
                "relevance": 1.0,
                "context_precision": 0.8,
                "hallucination_score": 0.1,
                "explanation": "Grounded answer.",
            },
        }

    monkeypatch.setattr(chat_routes.chat_service, "query_chat", fake_query_chat)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/chat/query",
        headers=auth_headers(user),
        json={"question": "What is DevPilot AI?", "retrieval_strategy": "hybrid"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "DevPilot AI uses FastAPI [1]."
