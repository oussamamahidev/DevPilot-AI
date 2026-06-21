from __future__ import annotations

import asyncio
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
from app.providers.base import (
    BaseEmbeddingProvider,
    EmbeddingProviderError,
    EmbeddingProviderTimeoutError,
)
from app.providers.ollama_provider import OllamaEmbeddingProvider


logger = logging.getLogger(__name__)

COLLECTION_NAME = "devpilot_chunks"
EMBEDDING_TIMEOUT_MAX_RETRIES = 3
EMBEDDING_TIMEOUT_INITIAL_BACKOFF_SECONDS = 1.0


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
    embeddings = await _embed_chunks_in_batches(
        chunks=chunks,
        document_id=document_uuid,
        provider=embedding_provider,
    )
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


async def _embed_chunks_in_batches(
    *,
    chunks: Sequence[Chunk],
    document_id: UUID,
    provider: BaseEmbeddingProvider,
) -> list[list[float]]:
    batch_size = settings.embedding_batch_size
    total_batches = (len(chunks) + batch_size - 1) // batch_size
    embeddings: list[list[float]] = []

    for batch_number, start in enumerate(range(0, len(chunks), batch_size), start=1):
        batch_chunks = chunks[start : start + batch_size]
        batch_texts = [chunk.content for chunk in batch_chunks]
        logger.info(
            "embedding batch %s/%s document_id=%s chunk_count=%s",
            batch_number,
            total_batches,
            str(document_id),
            len(batch_chunks),
            extra={
                "document_id": str(document_id),
                "embedding_batch": batch_number,
                "embedding_batch_total": total_batches,
                "chunk_count": len(batch_chunks),
            },
        )

        try:
            batch_embeddings = await _embed_batch_with_timeout_retries(
                provider=provider,
                texts=batch_texts,
                document_id=document_id,
                batch_number=batch_number,
                total_batches=total_batches,
            )
        except VectorStoreError:
            raise
        except EmbeddingProviderError as exc:
            raise VectorStoreError(
                f"Embedding batch {batch_number}/{total_batches} failed: {exc}"
            ) from exc

        if len(batch_embeddings) != len(batch_chunks):
            raise VectorStoreError(
                "Embedding provider returned an unexpected vector count for "
                f"batch {batch_number}/{total_batches} "
                f"expected={len(batch_chunks)} actual={len(batch_embeddings)}"
            )

        embeddings.extend(batch_embeddings)

    return embeddings


async def _embed_batch_with_timeout_retries(
    *,
    provider: BaseEmbeddingProvider,
    texts: Sequence[str],
    document_id: UUID,
    batch_number: int,
    total_batches: int,
) -> list[list[float]]:
    max_attempts = EMBEDDING_TIMEOUT_MAX_RETRIES + 1
    attempt = 1

    while True:
        try:
            return await provider.embed_batch(texts)
        except EmbeddingProviderTimeoutError as exc:
            if attempt >= max_attempts:
                raise VectorStoreError(
                    f"Ollama embedding batch {batch_number}/{total_batches} timed out "
                    f"after {EMBEDDING_TIMEOUT_MAX_RETRIES} retries: {exc}"
                ) from exc

            retry_in_seconds = EMBEDDING_TIMEOUT_INITIAL_BACKOFF_SECONDS * (
                2 ** (attempt - 1)
            )
            logger.warning(
                "Ollama embedding batch timed out; retrying document_id=%s "
                "embedding_batch=%s/%s attempt=%s/%s retry_in_seconds=%s",
                str(document_id),
                batch_number,
                total_batches,
                attempt,
                max_attempts,
                retry_in_seconds,
                extra={
                    "document_id": str(document_id),
                    "embedding_batch": batch_number,
                    "embedding_batch_total": total_batches,
                    "attempt": attempt,
                    "max_attempts": max_attempts,
                    "retry_in_seconds": retry_in_seconds,
                },
            )
            await asyncio.sleep(retry_in_seconds)
            attempt += 1


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


async def delete_vectors_by_ids(
    vector_ids: Sequence[str],
    *,
    client: AsyncQdrantClient | None = None,
) -> None:
    if not vector_ids:
        return

    qdrant = client or get_qdrant_client()
    should_close = client is None
    try:
        await qdrant.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.PointIdsList(points=list(vector_ids)),
            wait=True,
        )
    except Exception as exc:
        raise VectorStoreError("Qdrant vector delete by ids failed.") from exc
    finally:
        if should_close:
            await qdrant.close()


async def delete_vectors_by_workspace(
    workspace_id: UUID | str,
    *,
    client: AsyncQdrantClient | None = None,
) -> None:
    qdrant = client or get_qdrant_client()
    should_close = client is None
    try:
        await qdrant.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="workspace_id",
                            match=models.MatchValue(value=str(workspace_id)),
                        )
                    ]
                )
            ),
            wait=True,
        )
    except Exception as exc:
        raise VectorStoreError("Qdrant vector delete by workspace failed.") from exc
    finally:
        if should_close:
            await qdrant.close()


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
