from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.core.config import settings


async def rerank(
    query: str,
    contexts: list[dict[str, Any]],
    top_k: int = 5,
) -> list[dict[str, Any]]:
    if not contexts:
        return []

    try:
        return await _rerank_with_ollama(query=query, contexts=contexts, top_k=top_k)
    except Exception:
        return _rerank_with_heuristics(query=query, contexts=contexts, top_k=top_k)


async def _rerank_with_ollama(
    query: str,
    contexts: list[dict[str, Any]],
    top_k: int,
) -> list[dict[str, Any]]:
    if not settings.enable_ollama_reranker:
        raise RuntimeError("Ollama reranker is disabled")

    payload = {
        "model": settings.ollama_generation_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a retrieval reranker. Return only strict JSON with a "
                    "`ranked_chunk_ids` array ordered from most to least relevant."
                ),
            },
            {
                "role": "user",
                "content": _build_ollama_prompt(query=query, contexts=contexts, top_k=top_k),
            },
        ],
        "stream": False,
        "format": "json",
        "think": settings.ollama_chat_think,
        "options": {
            "temperature": 0,
            "num_predict": 200,
        },
    }
    async with httpx.AsyncClient(base_url=settings.ollama_url, timeout=30.0) as client:
        response = await client.post("/api/chat", json=payload)
        response.raise_for_status()

    data = response.json()
    message = data.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise RuntimeError("Ollama returned invalid reranker output")

    content = message["content"]
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start < 0 or end <= start:
            raise
        parsed = json.loads(content[start : end + 1])

    ranked_ids = parsed.get("ranked_chunk_ids") if isinstance(parsed, dict) else None
    if not isinstance(ranked_ids, list):
        raise RuntimeError("Ollama reranker returned no ranked_chunk_ids")

    contexts_by_id = {str(context.get("chunk_id")): context for context in contexts}
    ranked: list[dict[str, Any]] = []
    seen: set[str] = set()
    for chunk_id in ranked_ids:
        chunk_key = str(chunk_id)
        context = contexts_by_id.get(chunk_key)
        if context is None or chunk_key in seen:
            continue
        reranked_context = dict(context)
        metadata = dict(reranked_context.get("metadata") or {})
        metadata["reranker"] = "ollama"
        reranked_context["metadata"] = metadata
        reranked_context["rerank_score"] = 1 / (len(ranked) + 1)
        ranked.append(reranked_context)
        seen.add(chunk_key)
        if len(ranked) >= top_k:
            break

    if len(ranked) < top_k:
        for context in _rerank_with_heuristics(query=query, contexts=contexts, top_k=len(contexts)):
            chunk_key = str(context.get("chunk_id"))
            if chunk_key in seen:
                continue
            ranked.append(context)
            seen.add(chunk_key)
            if len(ranked) >= top_k:
                break

    return ranked[:top_k]


def _rerank_with_heuristics(
    query: str,
    contexts: list[dict[str, Any]],
    top_k: int,
) -> list[dict[str, Any]]:
    query_words = _keywords(query)
    query_terms = _query_terms(query)
    scored: list[tuple[float, int, dict[str, Any]]] = []

    for original_rank, context in enumerate(contexts, start=1):
        content = str(context.get("content", ""))
        content_words = _keywords(content)
        overlap = _overlap_score(query_words, content_words)
        exact_matches = _exact_term_matches(query_terms=query_terms, content=content)
        original_score = _original_score(context)
        rank_prior = 1 / (60 + original_rank)

        rerank_score = (
            (overlap * 0.5)
            + (min(exact_matches, 5) * 0.1)
            + (original_score * 0.3)
            + (rank_prior * 0.1)
        )
        reranked_context = dict(context)
        reranked_context["rerank_score"] = round(rerank_score, 6)
        metadata = dict(reranked_context.get("metadata") or {})
        metadata["reranker"] = "heuristic"
        metadata["rerank_features"] = {
            "overlap": round(overlap, 6),
            "exact_matches": exact_matches,
            "original_score": original_score,
            "original_rank": original_rank,
        }
        reranked_context["metadata"] = metadata
        scored.append((rerank_score, -original_rank, reranked_context))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [context for _, _, context in scored[:top_k]]


def _build_ollama_prompt(
    query: str,
    contexts: list[dict[str, Any]],
    top_k: int,
) -> str:
    blocks: list[str] = []
    for index, context in enumerate(contexts, start=1):
        blocks.append(
            f"""Rank: {index}
chunk_id: {context.get("chunk_id")}
content:
{str(context.get("content", ""))[:800]}"""
        )

    return f"""Query:
{query}

Return the {top_k} best chunk IDs for answering the query.

Candidates:
{chr(10).join(blocks)}

JSON shape:
{{"ranked_chunk_ids":["chunk-id-1","chunk-id-2"]}}"""


def _keywords(text: str) -> set[str]:
    stop_words = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "how",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "what",
        "with",
    }
    words = re.findall(r"[a-zA-Z0-9_]{3,}", text.lower())
    return {word for word in words if word not in stop_words}


def _query_terms(query: str) -> set[str]:
    quoted_terms = {
        match.strip().lower()
        for match in re.findall(r'"([^"]+)"|`([^`]+)`|\'([^\']+)\'', query)
        for match in match
        if match.strip()
    }
    return quoted_terms | _keywords(query)


def _exact_term_matches(query_terms: set[str], content: str) -> int:
    normalized_content = content.lower()
    matches = 0
    for term in query_terms:
        if not term:
            continue
        if " " in term:
            matches += int(term in normalized_content)
            continue
        matches += int(bool(re.search(rf"\b{re.escape(term)}\b", normalized_content)))
    return matches


def _overlap_score(source_words: set[str], target_words: set[str]) -> float:
    if not source_words:
        return 0.0
    return len(source_words & target_words) / len(source_words)


def _original_score(context: dict[str, Any]) -> float:
    source_scores = (context.get("metadata") or {}).get("source_scores")
    values: list[float] = []
    if isinstance(source_scores, dict):
        for score in source_scores.values():
            try:
                values.append(float(score))
            except (TypeError, ValueError):
                continue
    try:
        values.append(float(context.get("score", 0.0)))
    except (TypeError, ValueError):
        pass
    return max(values, default=0.0)
