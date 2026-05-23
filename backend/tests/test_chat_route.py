from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import chat as chat_routes
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.conversation import Conversation, Evaluation, Message
from app.main import app
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


@dataclass
class ChatRouteState:
    users: dict[str, User] = field(default_factory=dict)
    workspaces: dict[str, Workspace] = field(default_factory=dict)
    members: dict[str, WorkspaceMember] = field(default_factory=dict)
    conversations: dict[str, Conversation] = field(default_factory=dict)
    messages: dict[str, Message] = field(default_factory=dict)
    evaluations: dict[str, Evaluation] = field(default_factory=dict)


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

        if target is Evaluation:
            message = self.state.messages.get(str(criteria.get("id")))
            if message is None:
                return None

            conversation = self.state.conversations.get(str(message.conversation_id))
            if conversation is None:
                return None

            user_id = criteria.get("user_id")
            if user_id is not None:
                member = next(
                    (
                        item
                        for item in self.state.members.values()
                        if item.workspace_id == conversation.workspace_id
                        and str(item.user_id) == str(user_id)
                    ),
                    None,
                )
                if member is None:
                    return None

            return next(
                (
                    evaluation
                    for evaluation in self.state.evaluations.values()
                    if evaluation.message_id == message.id
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
def state() -> ChatRouteState:
    return ChatRouteState()


@pytest.fixture
def client(state: ChatRouteState) -> TestClient:
    async def override_get_db() -> AsyncGenerator[FakeChatRouteSession, None]:
        yield FakeChatRouteSession(state)

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


def make_workspace(state: ChatRouteState, owner: User) -> Workspace:
    workspace = Workspace(
        id=uuid4(),
        name="Chat Workspace",
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


def make_evaluated_message(
    state: ChatRouteState,
    workspace: Workspace,
    user: User,
) -> Message:
    conversation = Conversation(
        id=uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        title="Evaluation conversation",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    message = Message(
        id=uuid4(),
        conversation_id=conversation.id,
        role="assistant",
        content="DevPilot AI uses FastAPI [1].",
        created_at=datetime.now(UTC),
    )
    evaluation = Evaluation(
        id=uuid4(),
        message_id=message.id,
        faithfulness=0.9,
        relevance=1.0,
        context_precision=0.8,
        hallucination_score=0.1,
        explanation="Answer is grounded in the retrieved context.",
        created_at=datetime.now(UTC),
    )
    state.conversations[str(conversation.id)] = conversation
    state.messages[str(message.id)] = message
    state.evaluations[str(evaluation.id)] = evaluation
    return message


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def test_workspace_member_can_query_chat(
    client: TestClient,
    state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = make_user("chat-owner@example.com")
    state.users[str(user.id)] = user
    workspace = make_workspace(state, user)
    conversation_id = uuid4()
    message_id = uuid4()
    chunk_id = uuid4()
    document_id = uuid4()
    calls: list[dict[str, object]] = []

    async def fake_query_chat(**kwargs: object) -> dict[str, object]:
        calls.append(kwargs)
        return {
            "answer": "DevPilot AI uses FastAPI [1].",
            "citations": [
                {
                    "id": 1,
                    "document_id": document_id,
                    "filename": "phase9_test.txt",
                    "chunk_id": chunk_id,
                    "chunk_index": 0,
                    "score": 0.9,
                }
            ],
            "conversation_id": conversation_id,
            "message_id": message_id,
            "evaluation": {
                "faithfulness": 0.9,
                "relevance": 1.0,
                "context_precision": 0.8,
                "hallucination_score": 0.1,
                "explanation": "Answer is grounded in the retrieved context.",
            },
        }

    monkeypatch.setattr(chat_routes.chat_service, "query_chat", fake_query_chat)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/chat/query",
        headers=auth_headers(user),
        json={
            "question": "What is DevPilot AI?",
            "conversation_id": None,
            "retrieval_strategy": "keyword",
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "DevPilot AI uses FastAPI [1]."
    assert response.json()["citations"][0]["filename"] == "phase9_test.txt"
    assert response.json()["evaluation"]["faithfulness"] == 0.9
    assert calls[0]["workspace"] == workspace
    assert calls[0]["user"] == user
    assert calls[0]["question"] == "What is DevPilot AI?"
    assert calls[0]["retrieval_strategy"] == "keyword"


def test_non_member_cannot_query_chat(
    client: TestClient,
    state: ChatRouteState,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = make_user("chat-owner2@example.com")
    other_user = make_user("chat-other@example.com")
    state.users[str(owner.id)] = owner
    state.users[str(other_user.id)] = other_user
    workspace = make_workspace(state, owner)
    calls: list[dict[str, object]] = []

    async def fake_query_chat(**kwargs: object) -> dict[str, object]:
        calls.append(kwargs)
        return {}

    monkeypatch.setattr(chat_routes.chat_service, "query_chat", fake_query_chat)

    response = client.post(
        f"/api/v1/workspaces/{workspace.id}/chat/query",
        headers=auth_headers(other_user),
        json={"question": "What is DevPilot AI?", "conversation_id": None},
    )

    assert response.status_code == 403
    assert calls == []


def test_workspace_member_can_get_message_evaluation(
    client: TestClient,
    state: ChatRouteState,
) -> None:
    user = make_user("evaluation-owner@example.com")
    state.users[str(user.id)] = user
    workspace = make_workspace(state, user)
    message = make_evaluated_message(state, workspace, user)

    response = client.get(
        f"/api/v1/messages/{message.id}/evaluation",
        headers=auth_headers(user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["message_id"] == str(message.id)
    assert body["faithfulness"] == 0.9
    assert body["explanation"] == "Answer is grounded in the retrieved context."


def test_non_member_cannot_get_message_evaluation(
    client: TestClient,
    state: ChatRouteState,
) -> None:
    owner = make_user("evaluation-owner2@example.com")
    other_user = make_user("evaluation-other@example.com")
    state.users[str(owner.id)] = owner
    state.users[str(other_user.id)] = other_user
    workspace = make_workspace(state, owner)
    message = make_evaluated_message(state, workspace, owner)

    response = client.get(
        f"/api/v1/messages/{message.id}/evaluation",
        headers=auth_headers(other_user),
    )

    assert response.status_code == 404
