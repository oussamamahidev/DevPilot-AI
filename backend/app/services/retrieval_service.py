from __future__ import annotations

from time import perf_counter
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import RETRIEVAL_LATENCY_SECONDS
from app.db.session import AsyncSessionLocal
from app.models.document import Chunk, Document
from app.services import vector_store_service

RETRIEVAL_STRATEGIES = {"semantic", "keyword", "hybrid"}
RRF_K = 60


async def retrieve_semantic(
    workspace_id: UUID | str,
    query: str,
    top_k: int = 5,
    *,
    db: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    return await retrieve_chunks(
        workspace_id=workspace_id,
        query=query,
        top_k=top_k,
        strategy="semantic",
        db=db,
    )


async def retrieve_keyword(
    workspace_id: UUID | str,
    query: str,
    top_k: int = 5,
    *,
    db: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    return await retrieve_chunks(
        workspace_id=workspace_id,
        query=query,
        top_k=top_k,
        strategy="keyword",
        db=db,
    )


async def retrieve_chunks(
    workspace_id: UUID | str,
    query: str,
    top_k: int = 5,
    strategy: str = "hybrid",
    *,
    db: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    if db is None:
        async with AsyncSessionLocal() as session:
            return await retrieve_chunks(
                workspace_id=workspace_id,
                query=query,
                top_k=top_k,
                strategy=strategy,
                db=session,
            )

    started_at = perf_counter()
    status = "success"
    strategy_label = strategy.strip().lower() or "unknown"
    try:
        workspace_uuid = UUID(str(workspace_id))
        normalized_query = query.strip()
        if not normalized_query:
            return []

        normalized_strategy = strategy_label
        if normalized_strategy not in RETRIEVAL_STRATEGIES:
            raise ValueError(f"Unsupported retrieval strategy: {strategy}")

        if normalized_strategy == "semantic":
            return await _retrieve_semantic(
                db=db,
                workspace_id=workspace_uuid,
                query=normalized_query,
                top_k=top_k,
            )

        if normalized_strategy == "keyword":
            return await _retrieve_keyword(
                db=db,
                workspace_id=workspace_uuid,
                query=normalized_query,
                top_k=top_k,
            )

        return await _retrieve_hybrid(
            db=db,
            workspace_id=workspace_uuid,
            query=normalized_query,
            top_k=top_k,
        )
    except Exception:
        status = "error"
        raise
    finally:
        RETRIEVAL_LATENCY_SECONDS.labels(
            strategy=strategy_label,
            status=status,
        ).observe(perf_counter() - started_at)


async def _retrieve_semantic(
    db: AsyncSession,
    workspace_id: UUID,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    embedding_provider = vector_store_service.get_embedding_provider()
    query_vector = await embedding_provider.embed(query)
    points = await vector_store_service.search(
        workspace_id=workspace_id,
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
            Chunk.workspace_id == workspace_id,
            Chunk.id.in_(ranked_chunk_ids),
        )
    )
    chunks_by_id: dict[str, tuple[Chunk, str]] = {}
    for chunk, filename in rows.all():
        if chunk.workspace_id != workspace_id:
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
        result = _chunk_result(chunk=chunk, filename=filename, score=float(point.score))
        result["retrieval_strategy"] = "semantic"
        results.append(result)

    return results


async def _retrieve_keyword(
    db: AsyncSession,
    workspace_id: UUID,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    search_vector = func.to_tsvector("english", Chunk.content)
    search_query = func.plainto_tsquery("english", query)
    rank = func.ts_rank_cd(search_vector, search_query).label("score")

    rows = await db.execute(
        select(Chunk, Document.filename, rank)
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.workspace_id == workspace_id,
            search_vector.op("@@")(search_query),
        )
        .order_by(desc(rank), Chunk.created_at.desc())
        .limit(top_k)
    )

    results: list[dict[str, Any]] = []
    for chunk, filename, score in rows.all():
        result = _chunk_result(chunk=chunk, filename=filename, score=float(score or 0.0))
        result["retrieval_strategy"] = "keyword"
        results.append(result)
    return results


async def _retrieve_hybrid(
    db: AsyncSession,
    workspace_id: UUID,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    semantic_results = await _retrieve_semantic(
        db=db,
        workspace_id=workspace_id,
        query=query,
        top_k=top_k,
    )
    keyword_results = await _retrieve_keyword(
        db=db,
        workspace_id=workspace_id,
        query=query,
        top_k=top_k,
    )

    fused: dict[str, dict[str, Any]] = {}
    source_scores: dict[str, dict[str, float]] = {}

    for source, results in (
        ("semantic", semantic_results),
        ("keyword", keyword_results),
    ):
        for rank, result in enumerate(results, start=1):
            chunk_key = str(result["chunk_id"])
            if chunk_key not in fused:
                fused[chunk_key] = dict(result)
                fused[chunk_key]["score"] = 0.0
                source_scores[chunk_key] = {}
            fused[chunk_key]["score"] = float(fused[chunk_key].get("score", 0.0)) + (
                1 / (RRF_K + rank)
            )
            source_scores[chunk_key][source] = float(result["score"])

    ranked_results = sorted(
        fused.values(),
        key=lambda item: float(item["score"]),
        reverse=True,
    )
    for result in ranked_results:
        result["retrieval_strategy"] = "hybrid"
        metadata = dict(result.get("metadata") or {})
        metadata["source_scores"] = source_scores.get(str(result["chunk_id"]), {})
        result["metadata"] = metadata

    return ranked_results[:top_k]


def _chunk_result(chunk: Chunk, filename: str, score: float) -> dict[str, Any]:
    return {
        "chunk_id": chunk.id,
        "document_id": chunk.document_id,
        "filename": filename,
        "content": chunk.content,
        "chunk_index": chunk.chunk_index,
        "score": score,
        "metadata": dict(chunk.metadata_ or {}),
    }


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
