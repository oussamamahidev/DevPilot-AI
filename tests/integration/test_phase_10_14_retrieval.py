from __future__ import annotations

import httpx
import pytest

from conftest import auth_headers, require_status


pytestmark = [pytest.mark.live, pytest.mark.ingestion, pytest.mark.slow]


def _search(
    client: httpx.Client,
    api_base: str,
    token: str,
    workspace_id: str,
    *,
    query: str,
    strategy: str,
) -> list[dict[str, object]]:
    response = client.post(
        f"{api_base}/workspaces/{workspace_id}/retrieval/search",
        headers=auth_headers(token),
        json={"query": query, "top_k": 5, "strategy": strategy},
    )
    require_status(response, 200)
    payload = response.json()
    assert isinstance(payload, list)
    return payload


def test_phase_10_semantic_retrieval_returns_relevant_chunks(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
    indexed_document,
) -> None:
    _ = indexed_document
    results = _search(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        query="How does the platform process documents in the background?",
        strategy="semantic",
    )
    assert results
    assert results[0]["retrieval_strategy"] == "semantic"
    combined_content = " ".join(str(result["content"]).lower() for result in results)
    assert "celery" in combined_content or "redis" in combined_content
    assert all(isinstance(result["score"], int | float) for result in results)


def test_phase_10_invalid_token_is_rejected(
    http_client: httpx.Client,
    api_base_url: str,
    workspace,
) -> None:
    response = http_client.post(
        f"{api_base_url}/workspaces/{workspace.id}/retrieval/search",
        headers=auth_headers("invalid_token"),
        json={"query": "test", "top_k": 5, "strategy": "semantic"},
    )
    assert response.status_code == 401


def test_phase_14_keyword_and_hybrid_retrieval(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
    indexed_document,
) -> None:
    _ = indexed_document
    keyword_results = _search(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        query="Celery Redis Qdrant",
        strategy="keyword",
    )
    assert keyword_results
    assert keyword_results[0]["retrieval_strategy"] == "keyword"

    hybrid_results = _search(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        query="How does DevPilot use Qdrant and Celery?",
        strategy="hybrid",
    )
    assert hybrid_results
    assert hybrid_results[0]["retrieval_strategy"] == "hybrid"
    metadata = hybrid_results[0].get("metadata")
    assert isinstance(metadata, dict)
    assert "source_scores" in metadata
