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
    def __init__(self, rows: list[tuple[Chunk, str]]) -> None:
        self.rows = rows

    def all(self) -> list[tuple[Chunk, str]]:
        return self.rows


class FakeRetrievalSession:
    def __init__(self, rows: list[tuple[Chunk, str]]) -> None:
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
    assert results[0]["metadata"] == {"start_char": 21, "end_char": 42}
