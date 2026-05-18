from __future__ import annotations

import httpx
import pytest

from conftest import auth_headers, create_workspace, register_user, require_status


pytestmark = pytest.mark.live


def test_security_user_b_cannot_access_user_a_documents_or_chat(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    user_a = register_user(http_client, api_base_url, email_prefix="security-a")
    user_b = register_user(http_client, api_base_url, email_prefix="security-b")
    workspace_a = create_workspace(http_client, api_base_url, user_a.token)

    upload_response = http_client.post(
        f"{api_base_url}/workspaces/{workspace_a.id}/documents",
        headers=auth_headers(user_b.token),
        files={"file": ("security.txt", b"private content", "text/plain")},
    )
    assert upload_response.status_code in {403, 404}

    retrieval_response = http_client.post(
        f"{api_base_url}/workspaces/{workspace_a.id}/retrieval/search",
        headers=auth_headers(user_b.token),
        json={"query": "private", "top_k": 5, "strategy": "keyword"},
    )
    assert retrieval_response.status_code in {403, 404}

    chat_response = http_client.post(
        f"{api_base_url}/workspaces/{workspace_a.id}/chat/query",
        headers=auth_headers(user_b.token),
        json={"question": "What private content is available?"},
    )
    assert chat_response.status_code in {403, 404}


def test_security_ai_config_and_logs_do_not_expose_secrets(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    response = http_client.get(f"{api_base_url}/system/ai-config")
    require_status(response, 200)
    serialized_payload = response.text.lower()
    forbidden = ("gemini_api_key", "secret_key", "password", "authorization", "bearer ")
    for fragment in forbidden:
        assert fragment not in serialized_payload
