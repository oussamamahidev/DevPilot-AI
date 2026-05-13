from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.document import Chunk, Document
from app.providers.base import BaseEmbeddingProvider
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

    async def embed(self, text: str) -> list[float]:
        self.texts.append(text)
        return [0.1, 0.2, 0.3]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        self.texts.extend(texts)
        return [[0.1, 0.2, 0.3] for _ in texts]


class FakeQdrantClient:
    def __init__(self) -> None:
        self.points: list[object] = []

    async def upsert(self, **kwargs: object) -> None:
        self.points.extend(kwargs["points"])  # type: ignore[index]


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
