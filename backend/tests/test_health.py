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
os.environ.setdefault("OLLAMA_GENERATION_MODEL", "qwen3:8b")
os.environ.setdefault("OLLAMA_CHAT_THINK", "false")
os.environ.setdefault("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
os.environ.setdefault("EMBEDDING_DIMENSION", "768")
os.environ.setdefault("GENERATION_TEMPERATURE", "0.2")
os.environ.setdefault("GENERATION_MAX_TOKENS", "1000")
os.environ.setdefault("RAG_TOP_K", "5")
os.environ.setdefault("RAG_MAX_CONTEXT_CHARS", "6000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://localhost:3000")

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "DevPilot AI API",
    }


def test_api_v1_health_check() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "DevPilot AI API",
    }


def test_not_found_error_shape() -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"error": {"message": "Not Found"}}


def test_cors_origin_is_configured() -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
