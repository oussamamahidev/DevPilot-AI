from __future__ import annotations

import httpx
import pytest

from conftest import require_status


pytestmark = [pytest.mark.live, pytest.mark.frontend]


def _page(client: httpx.Client, frontend_url: str, path: str) -> str:
    response = client.get(f"{frontend_url}{path}")
    require_status(response, 200)
    assert "text/html" in response.headers.get("content-type", "")
    return response.text


def test_phase_17_auth_pages_render(http_client: httpx.Client, frontend_url: str) -> None:
    register_html = _page(http_client, frontend_url, "/register")
    login_html = _page(http_client, frontend_url, "/login")
    assert "Create your account" in register_html or "Register" in register_html
    assert "Sign in to DevPilot AI" in login_html or "Login" in login_html


def test_phase_19_settings_page_renders(http_client: httpx.Client, frontend_url: str) -> None:
    html = _page(http_client, frontend_url, "/settings")
    assert "Settings" in html
    assert "System configuration" in html or "Checking authentication" in html


@pytest.mark.xfail(reason="ChatQueryRequest does not currently expose retrieval_strategy")
def test_phase_19_chat_api_schema_exposes_retrieval_strategy(
    http_client: httpx.Client,
    backend_url: str,
) -> None:
    response = http_client.get(f"{backend_url}/openapi.json")
    require_status(response, 200)
    schema = response.json()["components"]["schemas"]["ChatQueryRequest"]
    assert "retrieval_strategy" in schema["properties"]


@pytest.mark.xfail(reason="/documents is currently a placeholder; workspace document UI lives under /workspaces/{id}/documents")
def test_phase_18_documents_route_is_not_placeholder(
    http_client: httpx.Client,
    frontend_url: str,
) -> None:
    html = _page(http_client, frontend_url, "/documents")
    assert "Documents module placeholder" not in html
    assert "Uploaded files" in html or "Upload" in html


@pytest.mark.xfail(reason="/chat is currently a placeholder; workspace chat UI lives under /workspaces/{id}/chat")
def test_phase_19_chat_route_is_not_placeholder(
    http_client: httpx.Client,
    frontend_url: str,
) -> None:
    html = _page(http_client, frontend_url, "/chat")
    assert "Chat module placeholder" not in html
    assert "Ask a question" in html or "Chat" in html
