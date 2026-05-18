from __future__ import annotations

import re

import httpx
import pytest

from conftest import docker_compose, require_status


pytestmark = pytest.mark.live


def test_phase_01_compose_config_and_services() -> None:
    config = docker_compose("config").stdout
    for service in ("postgres", "redis", "qdrant", "backend", "celery_worker", "frontend"):
        assert re.search(rf"^\s{{2}}{service}:", config, re.MULTILINE), service

    ps_output = docker_compose("ps").stdout
    for container_name in (
        "devpilot-postgres",
        "devpilot-redis",
        "devpilot-qdrant",
        "devpilot-backend",
        "devpilot-celery-worker",
        "devpilot-frontend",
    ):
        assert container_name in ps_output
    assert "Exited" not in ps_output
    assert "Restarting" not in ps_output


def test_phase_02_health_endpoint(
    http_client: httpx.Client,
    backend_url: str,
) -> None:
    response = http_client.get(f"{backend_url}/health")
    require_status(response, 200)
    payload = response.json()

    assert payload["status"] == "ok"
    assert payload.get("service") == "DevPilot AI API"


def test_phase_02_ai_config_is_safe(
    http_client: httpx.Client,
    api_base_url: str,
) -> None:
    response = http_client.get(f"{api_base_url}/system/ai-config")
    require_status(response, 200)
    payload = response.json()

    expected_fields = {
        "llm_provider",
        "embedding_provider",
        "generation_model",
        "embedding_model",
        "generation_temperature",
        "generation_max_tokens",
        "enable_reranking",
        "retrieval_candidates",
        "rerank_top_k",
    }
    assert expected_fields <= set(payload)
    assert payload["llm_provider"] in {"gemini", "ollama", "openai"}
    assert payload["embedding_provider"] in {"ollama", "openai"}
    assert payload["generation_model"]
    assert payload["embedding_model"]

    serialized_payload = str(payload).lower()
    forbidden_fragments = (
        "gemini_api_key",
        "secret_key",
        "database_url",
        "authorization",
        "bearer ",
    )
    for fragment in forbidden_fragments:
        assert fragment not in serialized_payload


def test_phase_16_frontend_shell_is_reachable(
    http_client: httpx.Client,
    frontend_url: str,
) -> None:
    response = http_client.get(frontend_url)
    require_status(response, 200)
    assert "text/html" in response.headers.get("content-type", "")
    assert "DevPilot" in response.text


def test_phase_16_cors_allows_frontend_origin(
    http_client: httpx.Client,
    backend_url: str,
    frontend_url: str,
) -> None:
    response = http_client.options(
        f"{backend_url}/api/v1/auth/login",
        headers={
            "Origin": frontend_url,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    require_status(response, 200)
    assert response.headers.get("access-control-allow-origin") == frontend_url
