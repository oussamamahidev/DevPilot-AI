from __future__ import annotations

import httpx
import pytest

from conftest import auth_headers, psql_json, require_status, upload_text_document, wait_for_document_status


pytestmark = [pytest.mark.live, pytest.mark.ingestion, pytest.mark.rag, pytest.mark.slow]


def _ask_chat(
    client: httpx.Client,
    api_base: str,
    token: str,
    workspace_id: str,
    question: str,
) -> dict[str, object]:
    response = client.post(
        f"{api_base}/workspaces/{workspace_id}/chat/query",
        headers=auth_headers(token),
        json={"question": question},
    )
    require_status(response, 200)
    payload = response.json()
    assert payload.get("answer")
    assert payload.get("message_id")
    assert payload.get("conversation_id")
    assert isinstance(payload.get("citations"), list)
    assert isinstance(payload.get("evaluation"), dict)
    return payload


def test_phase_11_12_13_chat_evaluation_and_agent_runs(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
    indexed_document,
) -> None:
    _ = indexed_document
    payload = _ask_chat(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        "What technologies does DevPilot AI use?",
    )

    assert payload["citations"]
    evaluation = payload["evaluation"]
    for key in ("faithfulness", "relevance", "context_precision", "hallucination_score"):
        assert key in evaluation
        assert 0 <= float(evaluation[key]) <= 1
    assert evaluation.get("explanation")

    message_id = payload["message_id"]
    evaluation_response = http_client.get(
        f"{api_base_url}/messages/{message_id}/evaluation",
        headers=auth_headers(registered_user.token),
    )
    require_status(evaluation_response, 200)
    assert evaluation_response.json()["message_id"] == message_id

    db_trace = psql_json(
        f"""
        select row_to_json(rows)
        from (
          select
            (select count(*)::int from retrieved_chunks where message_id = '{message_id}'::uuid) as retrieved_chunks,
            (select count(*)::int from evaluations where message_id = '{message_id}'::uuid) as evaluations,
            (select json_agg(agent_type order by created_at) from agent_runs where message_id = '{message_id}'::uuid) as agents
        ) rows;
        """
    )
    assert db_trace["retrieved_chunks"] > 0
    assert db_trace["evaluations"] == 1
    expected_agents = {"router", "query_rewriter", "retrieval", "generator", "evaluator", "corrector"}
    assert expected_agents <= set(db_trace["agents"])


def test_phase_12_unrelated_question_does_not_hallucinate(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
    indexed_document,
) -> None:
    _ = indexed_document
    payload = _ask_chat(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        "What is the CEO favorite food?",
    )
    answer = str(payload["answer"]).lower()
    assert "pizza" not in answer
    assert "sushi" not in answer
    assert "favorite food is" not in answer


def test_phase_15_reranking_prefers_relevant_document(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
) -> None:
    relevant_document = upload_text_document(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        filename="rerank-relevant.txt",
        content=(
            "DevPilot AI uses Celery for asynchronous document processing. "
            "Redis is used as the queue broker for background jobs. "
            "Qdrant stores vector embeddings and enables semantic search over document chunks."
        ),
    )
    irrelevant_document = upload_text_document(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        filename="rerank-irrelevant.txt",
        content=(
            "This document talks about football, training schedules, match analysis, "
            "and player performance. It does not explain document processing architecture."
        ),
    )
    wait_for_document_status(http_client, api_base_url, registered_user.token, relevant_document.id)
    wait_for_document_status(http_client, api_base_url, registered_user.token, irrelevant_document.id)

    payload = _ask_chat(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        "How do Celery and Qdrant work in DevPilot AI?",
    )
    citation_filenames = [citation["filename"] for citation in payload["citations"]]
    assert "rerank-relevant.txt" in citation_filenames
    if "rerank-irrelevant.txt" in citation_filenames:
        assert citation_filenames.index("rerank-relevant.txt") < citation_filenames.index(
            "rerank-irrelevant.txt"
        )

    reranker_runs = psql_json(
        f"""
        select coalesce(json_agg(row_to_json(rows)), '[]'::json)
        from (
          select agent_type, status, output
          from agent_runs
          where message_id = '{payload["message_id"]}'::uuid
            and agent_type = 'reranker'
        ) rows;
        """
    )
    assert reranker_runs
    assert reranker_runs[0]["status"] == "completed"
