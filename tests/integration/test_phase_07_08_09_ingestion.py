from __future__ import annotations

import httpx
import pytest

from conftest import (
    OLLAMA_URL,
    QDRANT_URL,
    auth_headers,
    docker_compose,
    psql_json,
    require_status,
    upload_text_document,
    wait_for_document_status,
)


pytestmark = [pytest.mark.live, pytest.mark.ingestion, pytest.mark.slow]


def test_phase_07_celery_processes_queued_document(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
) -> None:
    document = upload_text_document(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        filename="phase7-celery.txt",
        content=(
            "This document validates Celery and Redis. Celery processes uploaded "
            "documents asynchronously and persists indexed chunks."
        ),
    )
    status_payload = wait_for_document_status(
        http_client,
        api_base_url,
        registered_user.token,
        document.id,
    )
    assert status_payload["status"] == "indexed"

    celery_logs = docker_compose("logs", "celery_worker", "--tail=300").stdout
    assert "Traceback" not in celery_logs
    assert "ERROR" not in celery_logs


def test_phase_08_text_cleaning_chunking_and_metadata(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
) -> None:
    document = upload_text_document(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        filename="phase8-chunking.md",
        content=(
            "# DevPilot AI Architecture\n\n"
            "FastAPI exposes APIs for authentication, workspaces, documents, retrieval, and chat.\n\n"
            "Celery processes uploaded documents in the background. Redis is the broker.\n\n"
            "Qdrant stores embeddings for document chunks. Hybrid retrieval combines semantic and keyword search.\n\n"
            "Reranking reorders retrieved chunks before generation. Evaluation measures answer quality.\n"
        ),
    )
    wait_for_document_status(http_client, api_base_url, registered_user.token, document.id)

    chunks = psql_json(
        f"""
        select json_agg(row_to_json(rows) order by chunk_index)
        from (
          select chunk_index, length(content) as length, left(content, 120) as preview, metadata
          from chunks
          where document_id = '{document.id}'::uuid
          order by chunk_index
        ) rows;
        """
    )
    assert chunks
    assert chunks[0]["chunk_index"] == 0
    assert chunks[0]["length"] > 0
    assert "\u0000" not in chunks[0]["preview"]
    assert isinstance(chunks[0]["metadata"], dict)


def test_phase_09_ollama_embeddings_and_qdrant_indexing(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
) -> None:
    document = upload_text_document(
        http_client,
        api_base_url,
        registered_user.token,
        workspace.id,
        filename="phase9-vectors.txt",
        content=(
            "Qdrant stores vector embeddings for DevPilot AI chunks. "
            "Ollama nomic-embed-text creates embeddings for semantic retrieval."
        ),
    )
    wait_for_document_status(http_client, api_base_url, registered_user.token, document.id)

    vector_counts = psql_json(
        f"""
        select row_to_json(rows)
        from (
          select count(*)::int as chunks, count(vector_id)::int as chunks_with_vector_id
          from chunks
          where document_id = '{document.id}'::uuid
        ) rows;
        """
    )
    assert vector_counts["chunks"] > 0
    assert vector_counts["chunks_with_vector_id"] == vector_counts["chunks"]

    qdrant_response = http_client.get(f"{QDRANT_URL}/collections")
    require_status(qdrant_response, 200)
    collection_payload = qdrant_response.json()
    assert "collections" in collection_payload.get("result", {})


def test_phase_09_ollama_embedding_model_is_available(http_client: httpx.Client) -> None:
    response = http_client.get(f"{OLLAMA_URL}/api/tags")
    require_status(response, 200)
    payload = response.json()
    model_names = {
        model.get("name", "").split(":")[0]
        for model in payload.get("models", [])
        if isinstance(model, dict)
    }
    assert "nomic-embed-text" in model_names
