from __future__ import annotations

import re
from time import perf_counter
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import RETRIEVAL_LATENCY_SECONDS
from app.db.session import AsyncSessionLocal
from app.models.document import Chunk, Document
from app.providers.base import EmbeddingProviderError
from app.services import vector_store_service

RETRIEVAL_STRATEGIES = {"semantic", "keyword", "hybrid"}
RRF_K = 60
TEXT_FALLBACK_SCAN_LIMIT = 1000
TEXT_FALLBACK_SOURCE = "postgres_text_overlap"


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
    try:
        embedding_provider = vector_store_service.get_embedding_provider()
        query_vector = await embedding_provider.embed(query)
        points = await vector_store_service.search(
            workspace_id=workspace_id,
            query_vector=query_vector,
            top_k=top_k,
        )
    except (EmbeddingProviderError, vector_store_service.VectorStoreError):
        fallback = await _retrieve_text_fallback(
            db=db,
            workspace_id=workspace_id,
            query=query,
            top_k=top_k,
            retrieval_strategy="semantic",
        )
        if fallback:
            return fallback
        raise

    ranked_chunk_ids = _extract_ranked_chunk_ids(points)
    if not ranked_chunk_ids:
        return await _retrieve_text_fallback(
            db=db,
            workspace_id=workspace_id,
            query=query,
            top_k=top_k,
            retrieval_strategy="semantic",
        )

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

    if results:
        return results

    return await _retrieve_text_fallback(
        db=db,
        workspace_id=workspace_id,
        query=query,
        top_k=top_k,
        retrieval_strategy="semantic",
    )


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

    if results:
        return results

    return await _retrieve_text_fallback(
        db=db,
        workspace_id=workspace_id,
        query=query,
        top_k=top_k,
        retrieval_strategy="keyword",
    )


async def _retrieve_hybrid(
    db: AsyncSession,
    workspace_id: UUID,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    try:
        semantic_results = await _retrieve_semantic(
            db=db,
            workspace_id=workspace_id,
            query=query,
            top_k=top_k,
        )
    except (EmbeddingProviderError, vector_store_service.VectorStoreError):
        semantic_results = []
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


async def _retrieve_text_fallback(
    *,
    db: AsyncSession,
    workspace_id: UUID,
    query: str,
    top_k: int,
    retrieval_strategy: str,
) -> list[dict[str, Any]]:
    query_terms = _query_terms(query)
    if not query_terms:
        return []

    rows = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.workspace_id == workspace_id,
            Document.status != "deleted",
        )
        .order_by(desc(Chunk.created_at))
        .limit(TEXT_FALLBACK_SCAN_LIMIT)
    )

    scored: list[tuple[float, int, dict[str, Any]]] = []
    for original_rank, (chunk, filename) in enumerate(rows.all(), start=1):
        score = _text_overlap_score(
            query=query,
            query_terms=query_terms,
            content=chunk.content,
            filename=filename,
        )
        if score <= 0:
            continue

        result = _chunk_result(chunk=chunk, filename=filename, score=score)
        result["retrieval_strategy"] = retrieval_strategy
        metadata = dict(result.get("metadata") or {})
        source_scores = dict(metadata.get("source_scores") or {})
        source_scores[TEXT_FALLBACK_SOURCE] = score
        metadata["source_scores"] = source_scores
        metadata["fallback"] = TEXT_FALLBACK_SOURCE
        metadata["original_rank"] = original_rank
        result["metadata"] = metadata
        scored.append((score, -original_rank, result))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [result for _, _, result in scored[:top_k]]


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


def _query_terms(query: str) -> set[str]:
    stop_words = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "about",
        "available",
        "be",
        "by",
        "can",
        "does",
        "for",
        "from",
        "how",
        "in",
        "information",
        "is",
        "it",
        "list",
        "me",
        "of",
        "on",
        "or",
        "uploaded",
        "tell",
        "that",
        "the",
        "this",
        "to",
        "what",
        "which",
        "who",
        "why",
        "with",
    }
    terms = {
        term
        for term in re.findall(r"[\w-]{2,}", query.lower())
        if term not in stop_words
    }
    quoted_terms = {
        item.strip().lower()
        for match in re.findall(r'"([^"]+)"|`([^`]+)`|\'([^\']+)\'', query)
        for item in match
        if item.strip()
    }
    return terms | quoted_terms


def _text_overlap_score(
    *,
    query: str,
    query_terms: set[str],
    content: str,
    filename: str,
) -> float:
    normalized_content = content.lower()
    normalized_filename = filename.lower()
    normalized_query = " ".join(query.lower().split())
    content_terms = set(re.findall(r"[\w-]{2,}", normalized_content))
    filename_terms = set(re.findall(r"[\w-]{2,}", normalized_filename))

    overlap_count = len(query_terms & content_terms)
    filename_overlap_count = len(query_terms & filename_terms)
    phrase_bonus = 0.35 if normalized_query and normalized_query in normalized_content else 0.0
    quoted_phrase_bonus = sum(
        0.15
        for term in query_terms
        if " " in term and term in normalized_content
    )
    score = (
        (overlap_count / max(len(query_terms), 1))
        + (filename_overlap_count * 0.05)
        + phrase_bonus
        + min(quoted_phrase_bonus, 0.3)
    )
    return round(score, 6)


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
