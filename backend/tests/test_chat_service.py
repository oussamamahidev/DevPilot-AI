from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    LLMUsage,
    Message,
    RetrievedChunk,
)
from app.models.user import User
from app.models.workspace import Workspace
from app.providers.base import LLMResponse
from app.services import chat_service


class FakeChatSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits = 0

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

    async def scalar(self, statement: object) -> object | None:
        _ = statement
        return None


class FakeLLMProvider:
    async def generate(self, prompt: str, system_prompt: str) -> LLMResponse:
        assert "Context:" in prompt
        assert "[1] Source: phase9_test.txt | Chunk: 0" in prompt
        assert "What technologies does DevPilot AI use?" in prompt
        assert "private-document assistant" in system_prompt
        return LLMResponse(
            content="DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Ollama and Qdrant [1].",
            model="qwen3:8b",
            prompt_tokens=10,
            completion_tokens=12,
            total_tokens=22,
            latency_ms=123,
        )


@pytest.mark.asyncio
async def test_query_chat_saves_messages_citations_and_usage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = Workspace(
        id=uuid4(),
        name="Chat Workspace",
        description=None,
        owner_id=uuid4(),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    user = User(
        id=uuid4(),
        email="chat-service@example.com",
        full_name="Chat Service",
        password_hash="not-used",
        role="user",
        is_active=True,
    )
    chunk_id = uuid4()
    document_id = uuid4()
    session = FakeChatSession()

    async def fake_retrieve_chunks(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["workspace_id"] == workspace.id
        assert kwargs["query"] == "What technologies does DevPilot AI use?"
        assert kwargs["top_k"] == 15
        assert kwargs["strategy"] == "hybrid"
        return [
            {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "filename": "phase9_test.txt",
                "content": "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Ollama and Qdrant.",
                "chunk_index": 0,
                "score": 0.91,
                "metadata": {"start_char": 0, "end_char": 71},
            }
        ]

    monkeypatch.setattr(chat_service, "retrieve_chunks", fake_retrieve_chunks)

    async def fake_rerank(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["query"] == "What technologies does DevPilot AI use?"
        assert kwargs["top_k"] == 5
        assert len(kwargs["contexts"]) == 1  # type: ignore[arg-type]
        return list(kwargs["contexts"])  # type: ignore[arg-type]

    monkeypatch.setattr(chat_service, "rerank", fake_rerank)
    monkeypatch.setattr(chat_service, "OllamaLLMProvider", lambda: FakeLLMProvider())

    async def fake_evaluate_answer(**kwargs: object) -> dict[str, object]:
        assert kwargs["question"] == "What technologies does DevPilot AI use?"
        assert kwargs["answer"] == (
            "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Ollama and Qdrant [1]."
        )
        assert kwargs["contexts"][0]["chunk_id"] == chunk_id  # type: ignore[index]
        return {
            "faithfulness": 0.9,
            "relevance": 1.0,
            "context_precision": 0.8,
            "hallucination_score": 0.1,
            "explanation": "Answer is grounded in the retrieved context.",
        }

    monkeypatch.setattr(chat_service, "evaluate_answer", fake_evaluate_answer)

    response = await chat_service.query_chat(
        db=session,  # type: ignore[arg-type]
        workspace=workspace,
        user=user,
        question="What technologies does DevPilot AI use?",
    )

    messages = [item for item in session.added if isinstance(item, Message)]
    retrieved_chunks = [item for item in session.added if isinstance(item, RetrievedChunk)]
    usages = [item for item in session.added if isinstance(item, LLMUsage)]
    evaluations = [item for item in session.added if isinstance(item, Evaluation)]
    agent_runs = [item for item in session.added if isinstance(item, AgentRun)]

    assert response["answer"].endswith("[1].")
    assert response["citations"] == [
        {
            "id": 1,
            "document_id": document_id,
            "filename": "phase9_test.txt",
            "chunk_id": chunk_id,
            "chunk_index": 0,
            "score": 0.91,
        }
    ]
    assert response["evaluation"] == {
        "faithfulness": 0.9,
        "relevance": 1.0,
        "context_precision": 0.8,
        "hallucination_score": 0.1,
        "explanation": "Answer is grounded in the retrieved context.",
    }
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
    assert retrieved_chunks[0].message_id == messages[1].id
    assert retrieved_chunks[0].chunk_id == chunk_id
    assert evaluations[0].message_id == messages[1].id
    assert evaluations[0].faithfulness == 0.9
    assert evaluations[0].explanation == "Answer is grounded in the retrieved context."
    assert [agent_run.agent_type for agent_run in agent_runs] == [
        "router",
        "query_rewriter",
        "retrieval",
        "reranker",
        "generator",
        "evaluator",
        "corrector",
    ]
    assert all(agent_run.message_id == messages[1].id for agent_run in agent_runs)
    assert all(agent_run.status == "completed" for agent_run in agent_runs)
    assert usages[0].message_id == messages[1].id
    assert usages[0].provider == "ollama"
    assert usages[0].model == "qwen3:8b"
    assert usages[0].total_tokens == 22
