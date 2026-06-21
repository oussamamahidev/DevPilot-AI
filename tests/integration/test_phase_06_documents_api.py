from __future__ import annotations

import httpx
import pytest

from conftest import (
    auth_headers,
    psql_json,
    register_user,
    require_status,
    upload_text_document,
)


pytestmark = pytest.mark.live


def test_phase_06_document_upload_and_metadata(
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
        filename="phase6-doc.txt",
        content=(
            "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Qdrant, "
            "Ollama, hybrid retrieval, reranking, and evaluation."
        ),
    )

    status_response = http_client.get(
        f"{api_base_url}/documents/{document.id}/status",
        headers=auth_headers(registered_user.token),
    )
    require_status(status_response, 200)
    assert status_response.json()["status"] in {"uploaded", "queued", "processing", "indexed", "failed"}

    document_row = psql_json(
        f"""
        select row_to_json(docs)
        from (
          select id::text, workspace_id::text, filename, file_type, file_size, status, storage_path
          from documents
          where id = '{document.id}'::uuid
        ) docs;
        """
    )
    assert document_row["workspace_id"] == workspace.id
    assert document_row["filename"] == "phase6-doc.txt"
    assert document_row["file_size"] > 0
    assert ".." not in document_row["storage_path"]


def test_phase_06_invalid_file_and_auth_errors(
    http_client: httpx.Client,
    api_base_url: str,
    registered_user,
    workspace,
) -> None:
    invalid_response = http_client.post(
        f"{api_base_url}/workspaces/{workspace.id}/documents",
        headers=auth_headers(registered_user.token),
        files={"file": ("bad.exe", b"fake executable", "application/octet-stream")},
    )
    assert invalid_response.status_code in {400, 415}

    missing_token_response = http_client.post(
        f"{api_base_url}/workspaces/{workspace.id}/documents",
        files={"file": ("phase6-doc.txt", b"content", "text/plain")},
    )
    assert missing_token_response.status_code in {401, 403}

    other_user = register_user(http_client, api_base_url, email_prefix="phase6-other")
    unauthorized_response = http_client.post(
        f"{api_base_url}/workspaces/{workspace.id}/documents",
        headers=auth_headers(other_user.token),
        files={"file": ("phase6-doc.txt", b"content", "text/plain")},
    )
    assert unauthorized_response.status_code in {403, 404}
