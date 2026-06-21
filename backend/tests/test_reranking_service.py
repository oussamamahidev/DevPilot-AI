import pytest

from app.services import reranking_service


@pytest.mark.asyncio
async def test_rerank_heuristic_boosts_overlap_exact_terms_and_original_score(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_ollama(**kwargs: object) -> list[dict[str, object]]:
        _ = kwargs
        raise RuntimeError("ollama unavailable")

    monkeypatch.setattr(reranking_service, "_rerank_with_ollama", fail_ollama)

    contexts = [
        {
            "chunk_id": "low-overlap",
            "content": "General architecture overview with unrelated wording.",
            "score": 0.9,
            "metadata": {},
        },
        {
            "chunk_id": "exact-match",
            "content": "DevPilot AI uses Qdrant for vector search and Celery for processing.",
            "score": 0.4,
            "metadata": {},
        },
    ]

    results = await reranking_service.rerank(
        query="Qdrant Celery document processing",
        contexts=contexts,
        top_k=1,
    )

    assert results[0]["chunk_id"] == "exact-match"
    assert results[0]["rerank_score"] > 0
    assert results[0]["metadata"]["reranker"] == "heuristic"
    assert results[0]["metadata"]["rerank_features"]["exact_matches"] >= 2


@pytest.mark.asyncio
async def test_rerank_returns_empty_for_no_contexts() -> None:
    assert await reranking_service.rerank("anything", [], top_k=5) == []
