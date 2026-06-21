import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.document import Chunk, Document
from app.providers.base import BaseEmbeddingProvider, EmbeddingProviderTimeoutError
from app.services import vector_store_service


class FakeScalarResult:
    def __init__(self, items: list[Chunk]) -> None:
        self.items = items

    def all(self) -> list[Chunk]:
        return self.items


class FakeVectorSession:
    def __init__(self, document: Document, chunks: list[Chunk]) -> None:
        self.document = document
        self.chunks = chunks
        self.committed = False

    async def scalar(self, statement: object) -> Document | None:
        _ = statement
        return self.document

    async def scalars(self, statement: object) -> FakeScalarResult:
        _ = statement
        return FakeScalarResult(sorted(self.chunks, key=lambda chunk: chunk.chunk_index))

    async def commit(self) -> None:
        self.committed = True


class FakeEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self) -> None:
        self.texts: list[str] = []
        self.batches: list[list[str]] = []

    async def embed(self, text: str) -> list[float]:
        self.texts.append(text)
        return [0.1, 0.2, 0.3]

    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        batch = list(texts)
        self.texts.extend(batch)
        self.batches.append(batch)
        return [[0.1, 0.2, 0.3] for _ in batch]


class TimeoutThenSuccessEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, text: str) -> list[float]:
        _ = text
        raise NotImplementedError

    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        self.calls += 1
        if self.calls == 1:
            raise EmbeddingProviderTimeoutError("timed out")
        return [[0.1, 0.2, 0.3] for _ in texts]


class AlwaysTimeoutEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, text: str) -> list[float]:
        _ = text
        raise NotImplementedError

    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        _ = texts
        self.calls += 1
        raise EmbeddingProviderTimeoutError("timed out")


class FakeQdrantClient:
    def __init__(self) -> None:
        self.points: list[object] = []

    async def upsert(self, **kwargs: object) -> None:
        self.points.extend(kwargs["points"])  # type: ignore[index]


def make_document_and_chunks(chunk_count: int) -> tuple[Document, list[Chunk]]:
    workspace_id = uuid4()
    document_id = uuid4()
    document = Document(
        id=document_id,
        workspace_id=workspace_id,
        uploaded_by=uuid4(),
        filename="guide.txt",
        file_type="txt",
        file_size=100,
        status="processing",
        storage_path="storage/workspace/document/guide.txt",
        created_at=datetime.now(UTC),
        processed_at=None,
    )
    chunks = [
        Chunk(
            id=uuid4(),
            document_id=document_id,
            workspace_id=workspace_id,
            content=f"chunk {index}",
            chunk_index=index,
            token_count=2,
            metadata_={"start_char": index * 10, "end_char": index * 10 + 9},
        )
        for index in range(chunk_count)
    ]
    return document, chunks


@pytest.mark.asyncio
async def test_upsert_chunks_uses_embedding_provider_and_saves_vector_ids(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id = uuid4()
    document_id = uuid4()
    document = Document(
        id=document_id,
        workspace_id=workspace_id,
        uploaded_by=uuid4(),
        filename="guide.txt",
        file_type="txt",
        file_size=100,
        status="processing",
        storage_path="storage/workspace/document/guide.txt",
        created_at=datetime.now(UTC),
        processed_at=None,
    )
    chunks = [
        Chunk(
            id=uuid4(),
            document_id=document_id,
            workspace_id=workspace_id,
            content="first chunk",
            chunk_index=0,
            token_count=2,
            metadata_={"start_char": 0, "end_char": 11},
        ),
        Chunk(
            id=uuid4(),
            document_id=document_id,
            workspace_id=workspace_id,
            content="second chunk",
            chunk_index=1,
            token_count=2,
            metadata_={"start_char": 12, "end_char": 24},
        ),
    ]
    session = FakeVectorSession(document=document, chunks=chunks)
    provider = FakeEmbeddingProvider()
    client = FakeQdrantClient()

    async def fake_ensure_collection(client: object | None = None) -> None:
        _ = client
        return None

    monkeypatch.setattr(vector_store_service.settings, "embedding_dimension", 3)
    monkeypatch.setattr(vector_store_service, "ensure_collection", fake_ensure_collection)

    indexed_count = await vector_store_service.upsert_chunks(
        document_id=document_id,
        db=session,  # type: ignore[arg-type]
        provider=provider,
        client=client,  # type: ignore[arg-type]
    )

    assert indexed_count == 2
    assert provider.texts == ["first chunk", "second chunk"]
    assert session.committed is True
    assert [chunk.vector_id for chunk in chunks] == [str(chunk.id) for chunk in chunks]
    assert len(client.points) == 2
    assert client.points[0].payload == {
        "workspace_id": str(workspace_id),
        "document_id": str(document_id),
        "chunk_id": str(chunks[0].id),
        "chunk_index": 0,
        "filename": "guide.txt",
    }


@pytest.mark.asyncio
async def test_upsert_chunks_batches_embeddings_and_logs_progress(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    document, chunks = make_document_and_chunks(9)
    session = FakeVectorSession(document=document, chunks=chunks)
    provider = FakeEmbeddingProvider()
    client = FakeQdrantClient()

    async def fake_ensure_collection(client: object | None = None) -> None:
        _ = client
        return None

    monkeypatch.setattr(vector_store_service.settings, "embedding_dimension", 3)
    monkeypatch.setattr(vector_store_service.settings, "embedding_batch_size", 4)
    monkeypatch.setattr(vector_store_service, "ensure_collection", fake_ensure_collection)

    with caplog.at_level(logging.INFO, logger="app.services.vector_store_service"):
        indexed_count = await vector_store_service.upsert_chunks(
            document_id=document.id,
            db=session,  # type: ignore[arg-type]
            provider=provider,
            client=client,  # type: ignore[arg-type]
        )

    assert indexed_count == 9
    assert provider.batches == [
        ["chunk 0", "chunk 1", "chunk 2", "chunk 3"],
        ["chunk 4", "chunk 5", "chunk 6", "chunk 7"],
        ["chunk 8"],
    ]
    assert "embedding batch 1/3" in caplog.text
    assert "embedding batch 2/3" in caplog.text
    assert "embedding batch 3/3" in caplog.text
    assert len(client.points) == 9


@pytest.mark.asyncio
async def test_upsert_chunks_retries_embedding_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document, chunks = make_document_and_chunks(1)
    session = FakeVectorSession(document=document, chunks=chunks)
    provider = TimeoutThenSuccessEmbeddingProvider()
    client = FakeQdrantClient()
    sleep_delays: list[float] = []

    async def fake_ensure_collection(client: object | None = None) -> None:
        _ = client
        return None

    async def fake_sleep(delay: float) -> None:
        sleep_delays.append(delay)

    monkeypatch.setattr(vector_store_service.settings, "embedding_dimension", 3)
    monkeypatch.setattr(vector_store_service.settings, "embedding_batch_size", 4)
    monkeypatch.setattr(vector_store_service, "ensure_collection", fake_ensure_collection)
    monkeypatch.setattr(vector_store_service.asyncio, "sleep", fake_sleep)

    indexed_count = await vector_store_service.upsert_chunks(
        document_id=document.id,
        db=session,  # type: ignore[arg-type]
        provider=provider,
        client=client,  # type: ignore[arg-type]
    )

    assert indexed_count == 1
    assert provider.calls == 2
    assert sleep_delays == [1.0]


@pytest.mark.asyncio
async def test_upsert_chunks_raises_clear_error_after_timeout_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document, chunks = make_document_and_chunks(1)
    session = FakeVectorSession(document=document, chunks=chunks)
    provider = AlwaysTimeoutEmbeddingProvider()
    client = FakeQdrantClient()
    sleep_delays: list[float] = []

    async def fake_ensure_collection(client: object | None = None) -> None:
        _ = client
        return None

    async def fake_sleep(delay: float) -> None:
        sleep_delays.append(delay)

    monkeypatch.setattr(vector_store_service.settings, "embedding_dimension", 3)
    monkeypatch.setattr(vector_store_service.settings, "embedding_batch_size", 4)
    monkeypatch.setattr(vector_store_service, "EMBEDDING_TIMEOUT_MAX_RETRIES", 2)
    monkeypatch.setattr(vector_store_service, "ensure_collection", fake_ensure_collection)
    monkeypatch.setattr(vector_store_service.asyncio, "sleep", fake_sleep)

    with pytest.raises(vector_store_service.VectorStoreError) as exc_info:
        await vector_store_service.upsert_chunks(
            document_id=document.id,
            db=session,  # type: ignore[arg-type]
            provider=provider,
            client=client,  # type: ignore[arg-type]
        )

    assert "Ollama embedding batch 1/1 timed out after 2 retries" in str(exc_info.value)
    assert provider.calls == 3
    assert sleep_delays == [1.0, 2.0]
    assert client.points == []
