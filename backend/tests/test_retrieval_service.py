from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.document import Chunk
from app.services import retrieval_service


@dataclass
class FakePoint:
    payload: dict[str, object]
    score: float


class FakeEmbeddingProvider:
    def __init__(self) -> None:
        self.queries: list[str] = []

    async def embed(self, text: str) -> list[float]:
        self.queries.append(text)
        return [0.1, 0.2, 0.3]


class FakeExecuteResult:
    def __init__(self, rows: list[tuple[object, ...]]) -> None:
        self.rows = rows

    def all(self) -> list[tuple[object, ...]]:
        return self.rows


class FakeRetrievalSession:
    def __init__(self, rows: list[tuple[object, ...]]) -> None:
        self.rows = rows

    async def execute(self, statement: object) -> FakeExecuteResult:
        _ = statement
        return FakeExecuteResult(self.rows)


@pytest.mark.asyncio
async def test_retrieve_semantic_returns_ranked_hydrated_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id = uuid4()
    other_workspace_id = uuid4()
    document_id = uuid4()
    first_chunk = Chunk(
        id=uuid4(),
        document_id=document_id,
        workspace_id=workspace_id,
        content="First relevant chunk",
        chunk_index=0,
        token_count=3,
        metadata_={"start_char": 0, "end_char": 20},
        created_at=datetime.now(UTC),
    )
    second_chunk = Chunk(
        id=uuid4(),
        document_id=document_id,
        workspace_id=workspace_id,
        content="Second relevant chunk",
        chunk_index=1,
        token_count=3,
        metadata_={"start_char": 21, "end_char": 42},
        created_at=datetime.now(UTC),
    )
    other_workspace_chunk = Chunk(
        id=uuid4(),
        document_id=uuid4(),
        workspace_id=other_workspace_id,
        content="Should not leak",
        chunk_index=0,
        token_count=3,
        metadata_={},
        created_at=datetime.now(UTC),
    )
    provider = FakeEmbeddingProvider()
    search_calls: list[dict[str, object]] = []

    async def fake_search(workspace_id: object, query_vector: object, top_k: int) -> list[FakePoint]:
        search_calls.append(
            {
                "workspace_id": workspace_id,
                "query_vector": query_vector,
                "top_k": top_k,
            }
        )
        return [
            FakePoint(payload={"chunk_id": str(second_chunk.id)}, score=0.91),
            FakePoint(payload={"chunk_id": str(first_chunk.id)}, score=0.82),
            FakePoint(payload={"chunk_id": str(other_workspace_chunk.id)}, score=0.99),
        ]

    monkeypatch.setattr(
        retrieval_service.vector_store_service,
        "get_embedding_provider",
        lambda: provider,
    )
    monkeypatch.setattr(retrieval_service.vector_store_service, "search", fake_search)

    results = await retrieval_service.retrieve_semantic(
        db=FakeRetrievalSession(
            rows=[
                (first_chunk, "guide.txt"),
                (second_chunk, "guide.txt"),
                (other_workspace_chunk, "private.txt"),
            ]
        ),  # type: ignore[arg-type]
        workspace_id=workspace_id,
        query=" What is DevPilot AI? ",
        top_k=2,
    )

    assert provider.queries == ["What is DevPilot AI?"]
    assert search_calls == [
        {
            "workspace_id": workspace_id,
            "query_vector": [0.1, 0.2, 0.3],
            "top_k": 2,
        }
    ]
    assert [result["chunk_id"] for result in results] == [second_chunk.id, first_chunk.id]
    assert results[0]["content"] == "Second relevant chunk"
    assert results[0]["filename"] == "guide.txt"
    assert results[0]["score"] == 0.91
    assert results[0]["retrieval_strategy"] == "semantic"
    assert results[0]["metadata"] == {"start_char": 21, "end_char": 42}


@pytest.mark.asyncio
async def test_retrieve_keyword_returns_postgres_ranked_chunks() -> None:
    workspace_id = uuid4()
    document_id = uuid4()
    chunk = Chunk(
        id=uuid4(),
        document_id=document_id,
        workspace_id=workspace_id,
        content="FastAPI PostgreSQL Redis Celery Ollama Qdrant",
        chunk_index=0,
        token_count=6,
        metadata_={"start_char": 0, "end_char": 45},
        created_at=datetime.now(UTC),
    )

    results = await retrieval_service.retrieve_keyword(
        db=FakeRetrievalSession(rows=[(chunk, "stack.txt", 0.42)]),  # type: ignore[arg-type]
        workspace_id=workspace_id,
        query="FastAPI Qdrant",
        top_k=3,
    )

    assert results == [
        {
            "chunk_id": chunk.id,
            "document_id": document_id,
            "filename": "stack.txt",
            "content": "FastAPI PostgreSQL Redis Celery Ollama Qdrant",
            "chunk_index": 0,
            "score": 0.42,
            "metadata": {"start_char": 0, "end_char": 45},
            "retrieval_strategy": "keyword",
        }
    ]


@pytest.mark.asyncio
async def test_retrieve_hybrid_merges_semantic_and_keyword_with_rrf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id = uuid4()
    first_id = uuid4()
    second_id = uuid4()
    third_id = uuid4()

    async def fake_semantic(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["workspace_id"] == workspace_id
        assert kwargs["query"] == "FastAPI Qdrant"
        assert kwargs["top_k"] == 3
        return [
            {
                "chunk_id": first_id,
                "document_id": uuid4(),
                "filename": "semantic-1.txt",
                "content": "Semantic first",
                "chunk_index": 0,
                "score": 0.91,
                "metadata": {},
                "retrieval_strategy": "semantic",
            },
            {
                "chunk_id": second_id,
                "document_id": uuid4(),
                "filename": "shared.txt",
                "content": "Shared result",
                "chunk_index": 1,
                "score": 0.82,
                "metadata": {},
                "retrieval_strategy": "semantic",
            },
        ]

    async def fake_keyword(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["workspace_id"] == workspace_id
        assert kwargs["query"] == "FastAPI Qdrant"
        assert kwargs["top_k"] == 3
        return [
            {
                "chunk_id": second_id,
                "document_id": uuid4(),
                "filename": "shared.txt",
                "content": "Shared result",
                "chunk_index": 1,
                "score": 0.44,
                "metadata": {},
                "retrieval_strategy": "keyword",
            },
            {
                "chunk_id": third_id,
                "document_id": uuid4(),
                "filename": "keyword-2.txt",
                "content": "Keyword second",
                "chunk_index": 2,
                "score": 0.33,
                "metadata": {},
                "retrieval_strategy": "keyword",
            },
        ]

    monkeypatch.setattr(retrieval_service, "_retrieve_semantic", fake_semantic)
    monkeypatch.setattr(retrieval_service, "_retrieve_keyword", fake_keyword)

    results = await retrieval_service.retrieve_chunks(
        db=FakeRetrievalSession(rows=[]),  # type: ignore[arg-type]
        workspace_id=workspace_id,
        query="FastAPI Qdrant",
        top_k=3,
        strategy="hybrid",
    )

    assert [result["chunk_id"] for result in results] == [second_id, first_id, third_id]
    assert all(result["retrieval_strategy"] == "hybrid" for result in results)
    assert results[0]["score"] == pytest.approx((1 / 62) + (1 / 61))
    assert results[0]["metadata"]["source_scores"] == {  # type: ignore[index]
        "semantic": 0.82,
        "keyword": 0.44,
    }
