from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.document import Chunk, Document
from app.services import vector_store_service


async def retrieve_semantic(
    workspace_id: UUID | str,
    query: str,
    top_k: int = 5,
    *,
    db: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    if db is None:
        async with AsyncSessionLocal() as session:
            return await retrieve_semantic(
                workspace_id=workspace_id,
                query=query,
                top_k=top_k,
                db=session,
            )

    workspace_uuid = UUID(str(workspace_id))
    normalized_query = query.strip()
    if not normalized_query:
        return []

    embedding_provider = vector_store_service.get_embedding_provider()
    query_vector = await embedding_provider.embed(normalized_query)
    points = await vector_store_service.search(
        workspace_id=workspace_uuid,
        query_vector=query_vector,
        top_k=top_k,
    )

    ranked_chunk_ids = _extract_ranked_chunk_ids(points)
    if not ranked_chunk_ids:
        return []

    rows = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.workspace_id == workspace_uuid,
            Chunk.id.in_(ranked_chunk_ids),
        )
    )
    chunks_by_id: dict[str, tuple[Chunk, str]] = {}
    for chunk, filename in rows.all():
        if chunk.workspace_id != workspace_uuid:
            continue
        chunks_by_id[str(chunk.id)] = (chunk, filename)

    results: list[dict[str, Any]] = []
    for point in points:
        payload = point.payload or {}
        chunk_id = payload.get("chunk_id")
        if not isinstance(chunk_id, str):
            continue

        chunk_row = chunks_by_id.get(chunk_id)
        if chunk_row is None:
            continue

        chunk, filename = chunk_row
        results.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": filename,
                "content": chunk.content,
                "chunk_index": chunk.chunk_index,
                "score": float(point.score),
                "metadata": dict(chunk.metadata_ or {}),
            }
        )

    return results


def _extract_ranked_chunk_ids(points: list[object]) -> list[UUID]:
    chunk_ids: list[UUID] = []
    seen: set[UUID] = set()

    for point in points:
        payload = getattr(point, "payload", None) or {}
        chunk_id = payload.get("chunk_id") if isinstance(payload, dict) else None
        if not isinstance(chunk_id, str):
            continue

        try:
            chunk_uuid = UUID(chunk_id)
        except ValueError:
            continue

        if chunk_uuid in seen:
            continue
        seen.add(chunk_uuid)
        chunk_ids.append(chunk_uuid)

    return chunk_ids
