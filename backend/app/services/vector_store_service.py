from __future__ import annotations

import logging
from collections.abc import Sequence
from uuid import UUID

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.document import Chunk, Document
from app.providers.base import BaseEmbeddingProvider
from app.providers.ollama_provider import OllamaEmbeddingProvider


logger = logging.getLogger(__name__)

COLLECTION_NAME = "devpilot_chunks"


class VectorStoreError(RuntimeError):
    """Raised when vector indexing or search cannot be completed."""


def get_embedding_provider() -> BaseEmbeddingProvider:
    if settings.embedding_provider == "ollama":
        return OllamaEmbeddingProvider()

    raise VectorStoreError(f"Unsupported embedding provider: {settings.embedding_provider}")


def get_qdrant_client() -> AsyncQdrantClient:
    return AsyncQdrantClient(url=str(settings.qdrant_url), timeout=10.0)


async def ensure_collection(client: AsyncQdrantClient | None = None) -> models.CollectionInfo:
    qdrant = client or get_qdrant_client()

    try:
        exists = await qdrant.collection_exists(COLLECTION_NAME)
        if not exists:
            await qdrant.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=settings.embedding_dimension,
                    distance=models.Distance.COSINE,
                ),
            )
            logger.info(
                "Qdrant collection created collection=%s vector_size=%s distance=cosine",
                COLLECTION_NAME,
                settings.embedding_dimension,
                extra={
                    "collection": COLLECTION_NAME,
                    "vector_size": settings.embedding_dimension,
                    "distance": "cosine",
                },
            )

        collection = await qdrant.get_collection(COLLECTION_NAME)
    except Exception as exc:
        raise VectorStoreError(
            "Qdrant is not reachable. Confirm the qdrant service is running and QDRANT_URL "
            f"is correct: {settings.qdrant_url}"
        ) from exc

    _validate_collection(collection)
    return collection


async def upsert_chunk_vector(
    chunk: Chunk,
    embedding: Sequence[float],
    *,
    filename: str,
    client: AsyncQdrantClient | None = None,
) -> str:
    _validate_embedding_dimension(embedding)

    qdrant = client or get_qdrant_client()
    vector_id = chunk.vector_id or str(chunk.id)
    payload = {
        "workspace_id": str(chunk.workspace_id),
        "document_id": str(chunk.document_id),
        "chunk_id": str(chunk.id),
        "chunk_index": chunk.chunk_index,
        "filename": filename,
    }

    try:
        await qdrant.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=vector_id,
                    vector=[float(value) for value in embedding],
                    payload=payload,
                )
            ],
            wait=True,
        )
    except Exception as exc:
        raise VectorStoreError(
            "Qdrant is not reachable or rejected the vector upsert. Confirm the qdrant "
            "service is running and the collection configuration is valid."
        ) from exc

    chunk.vector_id = vector_id
    return vector_id


async def upsert_chunks(
    document_id: UUID | str,
    *,
    db: AsyncSession | None = None,
    provider: BaseEmbeddingProvider | None = None,
    client: AsyncQdrantClient | None = None,
) -> int:
    if db is None:
        async with AsyncSessionLocal() as session:
            return await upsert_chunks(
                document_id=document_id,
                db=session,
                provider=provider,
                client=client,
            )

    document_uuid = UUID(str(document_id))
    document = await db.scalar(select(Document).where(Document.id == document_uuid))
    if document is None:
        raise VectorStoreError(f"Document not found for vector indexing: {document_id}")

    chunk_result = await db.scalars(
        select(Chunk)
        .where(Chunk.document_id == document_uuid)
        .order_by(Chunk.chunk_index)
    )
    chunks = list(chunk_result.all())
    if not chunks:
        logger.info(
            "No chunks to vectorize document_id=%s",
            str(document_uuid),
            extra={"document_id": str(document_uuid), "chunk_count": 0},
        )
        return 0

    qdrant = client or get_qdrant_client()
    embedding_provider = provider or get_embedding_provider()

    await ensure_collection(client=qdrant)
    embeddings = await embedding_provider.embed_batch([chunk.content for chunk in chunks])
    if len(embeddings) != len(chunks):
        raise VectorStoreError(
            "Embedding provider returned an unexpected vector count "
            f"expected={len(chunks)} actual={len(embeddings)}"
        )

    for chunk, embedding in zip(chunks, embeddings, strict=True):
        await upsert_chunk_vector(
            chunk,
            embedding,
            filename=document.filename,
            client=qdrant,
        )

    await db.commit()
    logger.info(
        "Document chunk vectors indexed document_id=%s chunk_count=%s",
        str(document_uuid),
        len(chunks),
        extra={"document_id": str(document_uuid), "chunk_count": len(chunks)},
    )
    return len(chunks)


async def search(
    workspace_id: UUID | str,
    query_vector: Sequence[float],
    top_k: int,
    *,
    client: AsyncQdrantClient | None = None,
) -> list[models.ScoredPoint]:
    if top_k <= 0:
        raise ValueError("top_k must be greater than 0")
    _validate_embedding_dimension(query_vector)

    qdrant = client or get_qdrant_client()
    try:
        response = await qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=[float(value) for value in query_vector],
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="workspace_id",
                        match=models.MatchValue(value=str(workspace_id)),
                    )
                ]
            ),
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        )
    except Exception as exc:
        raise VectorStoreError(
            "Qdrant search failed. Confirm the qdrant service is running and the "
            f"{COLLECTION_NAME} collection exists."
        ) from exc

    return list(response.points)


async def get_collection_status(
    client: AsyncQdrantClient | None = None,
) -> dict[str, object]:
    qdrant = client or get_qdrant_client()
    try:
        exists = await qdrant.collection_exists(COLLECTION_NAME)
        if not exists:
            return {
                "status": "missing",
                "collection": COLLECTION_NAME,
                "collection_exists": False,
            }

        collection = await qdrant.get_collection(COLLECTION_NAME)
    except Exception as exc:
        raise VectorStoreError(
            "Qdrant is not reachable. Confirm the qdrant service is running and QDRANT_URL "
            f"is correct: {settings.qdrant_url}"
        ) from exc

    vector_size = _extract_vector_size(collection)
    distance = _extract_distance(collection)
    return {
        "status": str(collection.status.value if hasattr(collection.status, "value") else collection.status),
        "collection": COLLECTION_NAME,
        "collection_exists": True,
        "points_count": collection.points_count,
        "indexed_vectors_count": collection.indexed_vectors_count,
        "vector_size": vector_size,
        "distance": distance,
    }


def _validate_embedding_dimension(embedding: Sequence[float]) -> None:
    if len(embedding) != settings.embedding_dimension:
        raise VectorStoreError(
            "Embedding dimension mismatch "
            f"expected={settings.embedding_dimension} actual={len(embedding)}"
        )


def _validate_collection(collection: models.CollectionInfo) -> None:
    vector_size = _extract_vector_size(collection)
    if vector_size is not None and vector_size != settings.embedding_dimension:
        raise VectorStoreError(
            "Qdrant collection vector size mismatch "
            f"collection={COLLECTION_NAME} expected={settings.embedding_dimension} actual={vector_size}"
        )


def _extract_vector_size(collection: models.CollectionInfo) -> int | None:
    vectors = collection.config.params.vectors
    if isinstance(vectors, models.VectorParams):
        return vectors.size
    if isinstance(vectors, dict):
        first_vector = next(iter(vectors.values()), None)
        if isinstance(first_vector, models.VectorParams):
            return first_vector.size
    return None


def _extract_distance(collection: models.CollectionInfo) -> str | None:
    vectors = collection.config.params.vectors
    distance: object | None = None
    if isinstance(vectors, models.VectorParams):
        distance = vectors.distance
    elif isinstance(vectors, dict):
        first_vector = next(iter(vectors.values()), None)
        if isinstance(first_vector, models.VectorParams):
            distance = first_vector.distance

    if distance is None:
        return None
    return str(distance.value if hasattr(distance, "value") else distance)
