from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.document import Chunk, Document
from app.services import retrieval_service


class FakeRows:
    def __init__(self, rows: list[tuple[Chunk, str]]) -> None:
        self.rows = rows

    def all(self) -> list[tuple[Chunk, str]]:
        return self.rows


class FakeRetrievalSession:
    def __init__(self, rows: list[tuple[Chunk, str]]) -> None:
        self.rows = rows

    async def execute(self, statement: object) -> FakeRows:
        _ = statement
        return FakeRows(self.rows)


def make_chunk(
    *,
    content: str,
    filename: str,
    index: int,
    workspace_id: object,
) -> tuple[Chunk, str]:
    document_id = uuid4()
    document = Document(
        id=document_id,
        workspace_id=workspace_id,  # type: ignore[arg-type]
        uploaded_by=uuid4(),
        filename=filename,
        file_type="txt",
        file_size=len(content),
        status="indexed",
        storage_path=f"storage/{document_id}/{filename}",
        created_at=datetime.now(UTC),
        processed_at=datetime.now(UTC),
    )
    chunk = Chunk(
        id=uuid4(),
        document_id=document.id,
        workspace_id=workspace_id,  # type: ignore[arg-type]
        content=content,
        chunk_index=index,
        token_count=len(content.split()),
        metadata_={"start_char": 0, "end_char": len(content)},
        created_at=datetime.now(UTC),
    )
    return chunk, filename


@pytest.mark.asyncio
async def test_text_fallback_finds_uploaded_chunk_when_vector_search_misses() -> None:
    workspace_id = uuid4()
    relevant = make_chunk(
        workspace_id=workspace_id,
        filename="project-stack.txt",
        index=0,
        content=(
            "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Qdrant, "
            "Ollama embeddings, and Gemini generation."
        ),
    )
    irrelevant = make_chunk(
        workspace_id=workspace_id,
        filename="meeting-notes.txt",
        index=1,
        content="The meeting notes mention timeline planning and presentation logistics.",
    )
    session = FakeRetrievalSession([irrelevant, relevant])

    results = await retrieval_service._retrieve_text_fallback(  # noqa: SLF001
        db=session,  # type: ignore[arg-type]
        workspace_id=workspace_id,
        query="What technologies does DevPilot AI use?",
        top_k=3,
        retrieval_strategy="hybrid",
    )

    assert results
    assert results[0]["filename"] == "project-stack.txt"
    assert "FastAPI" in results[0]["content"]
    assert results[0]["retrieval_strategy"] == "hybrid"
    assert results[0]["metadata"]["fallback"] == retrieval_service.TEXT_FALLBACK_SOURCE
    assert retrieval_service.TEXT_FALLBACK_SOURCE in results[0]["metadata"]["source_scores"]


@pytest.mark.asyncio
async def test_hybrid_retrieval_uses_text_fallback_when_semantic_and_keyword_are_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id = uuid4()
    fallback_chunk = {
        "chunk_id": uuid4(),
        "document_id": uuid4(),
        "filename": "guide.txt",
        "content": "The uploaded file says the support email is support@example.com.",
        "chunk_index": 0,
        "score": 0.75,
        "metadata": {"fallback": retrieval_service.TEXT_FALLBACK_SOURCE},
        "retrieval_strategy": "semantic",
    }

    async def fake_semantic(**kwargs: object) -> list[dict[str, object]]:
        _ = kwargs
        return [fallback_chunk]

    async def fake_keyword(**kwargs: object) -> list[dict[str, object]]:
        _ = kwargs
        return []

    monkeypatch.setattr(retrieval_service, "_retrieve_semantic", fake_semantic)
    monkeypatch.setattr(retrieval_service, "_retrieve_keyword", fake_keyword)

    results = await retrieval_service._retrieve_hybrid(  # noqa: SLF001
        db=object(),  # type: ignore[arg-type]
        workspace_id=workspace_id,
        query="What is the support email?",
        top_k=5,
    )

    assert len(results) == 1
    assert results[0]["filename"] == "guide.txt"
    assert results[0]["retrieval_strategy"] == "hybrid"
    assert results[0]["metadata"]["source_scores"]["semantic"] > 0


@pytest.mark.asyncio
async def test_hybrid_retrieval_degrades_to_keyword_when_semantic_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id = uuid4()
    keyword_chunk = {
        "chunk_id": uuid4(),
        "document_id": uuid4(),
        "filename": "guide.txt",
        "content": "The uploaded file says the support email is support@example.com.",
        "chunk_index": 0,
        "score": 0.9,
        "metadata": {},
        "retrieval_strategy": "keyword",
    }

    async def fake_semantic(**kwargs: object) -> list[dict[str, object]]:
        _ = kwargs
        raise retrieval_service.vector_store_service.VectorStoreError("Qdrant unavailable")

    async def fake_keyword(**kwargs: object) -> list[dict[str, object]]:
        _ = kwargs
        return [keyword_chunk]

    monkeypatch.setattr(retrieval_service, "_retrieve_semantic", fake_semantic)
    monkeypatch.setattr(retrieval_service, "_retrieve_keyword", fake_keyword)

    results = await retrieval_service._retrieve_hybrid(  # noqa: SLF001
        db=object(),  # type: ignore[arg-type]
        workspace_id=workspace_id,
        query="What is the support email?",
        top_k=5,
    )

    assert len(results) == 1
    assert results[0]["filename"] == "guide.txt"
    assert results[0]["retrieval_strategy"] == "hybrid"
    assert results[0]["metadata"]["source_scores"]["keyword"] > 0
