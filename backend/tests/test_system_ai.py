import os

os.environ.setdefault("APP_NAME", "DevPilot AI")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough")
os.environ.setdefault("POSTGRES_USER", "devpilot")
os.environ.setdefault("POSTGRES_PASSWORD", "devpilot")
os.environ.setdefault("POSTGRES_DB", "devpilot")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://devpilot:devpilot@localhost:5432/devpilot")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("EMBEDDING_PROVIDER", "ollama")
os.environ.setdefault("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
os.environ.setdefault("OLLAMA_GENERATION_MODEL", "qwen2.5:3b-instruct-q3_K_S")
os.environ.setdefault("OLLAMA_CHAT_THINK", "false")
os.environ.setdefault("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
os.environ.setdefault("EMBEDDING_DIMENSION", "768")
os.environ.setdefault("GENERATION_TEMPERATURE", "0.2")
os.environ.setdefault("GENERATION_MAX_TOKENS", "1000")
os.environ.setdefault("RAG_TOP_K", "5")
os.environ.setdefault("RAG_MAX_CONTEXT_CHARS", "6000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://localhost:3000")

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.routes import system as system_routes
from app.main import app
from app.services.vector_store_service import VectorStoreError


client = TestClient(app)


def test_ai_config_is_ollama_first() -> None:
    response = client.get("/api/v1/system/ai-config")

    assert response.status_code == 200
    assert response.json() == {
        "llm_provider": "ollama",
        "embedding_provider": "ollama",
        "generation_model": "qwen2.5:3b-instruct-q3_K_S",
        "embedding_model": "nomic-embed-text",
        "generation_temperature": 0.2,
        "generation_max_tokens": 1000,
        "enable_reranking": True,
        "retrieval_candidates": 15,
        "rerank_top_k": 5,
    }


def test_ai_config_is_safe_for_gemini(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(system_routes.settings, "llm_provider", "gemini")
    monkeypatch.setattr(system_routes.settings, "gemini_api_key", "secret-api-key")
    monkeypatch.setattr(system_routes.settings, "gemini_generation_model", "gemini-2.5-flash")
    monkeypatch.setattr(system_routes.settings, "gemini_temperature", 0.2)
    monkeypatch.setattr(system_routes.settings, "gemini_max_output_tokens", 1000)

    response = client.get("/api/v1/system/ai-config")

    assert response.status_code == 200
    data = response.json()
    assert data == {
        "llm_provider": "gemini",
        "embedding_provider": "ollama",
        "generation_model": "gemini-2.5-flash",
        "embedding_model": "nomic-embed-text",
        "generation_temperature": 0.2,
        "generation_max_tokens": 1000,
        "enable_reranking": True,
        "retrieval_candidates": 15,
        "rerank_top_k": 5,
        "gemini_generation_model": "gemini-2.5-flash",
    }
    assert "GEMINI_API_KEY" not in data
    assert "secret-api-key" not in response.text


def test_ai_health_returns_ok_for_reachable_ollama(monkeypatch) -> None:
    async def fake_list_ollama_models(_: str) -> list[dict[str, object]]:
        return [{"name": "qwen2.5:3b-instruct-q3_K_S"}, {"name": "nomic-embed-text:latest"}]

    monkeypatch.setattr(system_routes, "list_ollama_models", fake_list_ollama_models)

    response = client.get("/api/v1/system/ai-health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["provider"] == "ollama"
    assert "qwen2.5:3b-instruct-q3_K_S" in response.json()["models"]
    assert response.json()["generation_model_available"] is True
    assert response.json()["embedding_model_available"] is True
    assert response.json()["warnings"] == []


def test_ai_health_returns_warnings_for_missing_models(monkeypatch) -> None:
    async def fake_list_ollama_models(_: str) -> list[dict[str, object]]:
        return [{"name": "other-model"}]

    monkeypatch.setattr(system_routes, "list_ollama_models", fake_list_ollama_models)

    response = client.get("/api/v1/system/ai-health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["generation_model_available"] is False
    assert response.json()["embedding_model_available"] is False
    assert len(response.json()["warnings"]) == 2


def test_ai_health_returns_clean_503_for_unreachable_ollama(monkeypatch) -> None:
    async def fake_list_ollama_models(base_url: str) -> list[dict[str, object]]:
        request = httpx.Request("GET", f"{base_url}/api/tags")
        raise httpx.ConnectError("connection refused", request=request)

    monkeypatch.setattr(system_routes, "list_ollama_models", fake_list_ollama_models)

    response = client.get("/api/v1/system/ai-health")

    assert response.status_code == 503
    assert response.json()["status"] == "error"
    assert response.json()["provider"] == "ollama"
    assert response.json()["ollama_base_url"] == "http://host.docker.internal:11434"
    assert response.json()["models"] == []


def test_vector_health_returns_collection_status(monkeypatch) -> None:
    async def fake_get_collection_status() -> dict[str, object]:
        return {
            "status": "green",
            "collection": "devpilot_chunks",
            "collection_exists": True,
            "points_count": 2,
            "indexed_vectors_count": 2,
            "vector_size": 768,
            "distance": "Cosine",
        }

    monkeypatch.setattr(system_routes, "get_collection_status", fake_get_collection_status)

    response = client.get("/api/v1/system/vector-health")

    assert response.status_code == 200
    assert response.json()["collection"] == "devpilot_chunks"
    assert response.json()["collection_exists"] is True


def test_vector_health_returns_503_when_qdrant_unreachable(monkeypatch) -> None:
    async def fake_get_collection_status() -> dict[str, object]:
        raise VectorStoreError("Qdrant is not reachable")

    monkeypatch.setattr(system_routes, "get_collection_status", fake_get_collection_status)

    response = client.get("/api/v1/system/vector-health")

    assert response.status_code == 503
    assert response.json() == {"error": {"message": "Qdrant is not reachable"}}
