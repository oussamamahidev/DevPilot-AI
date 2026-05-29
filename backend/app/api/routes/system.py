import asyncio
from datetime import UTC, datetime
from time import perf_counter

import httpx
import redis.asyncio as redis
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.ai.ollama import list_ollama_models
from app.services.vector_store_service import VectorStoreError, get_collection_status
from app.workers.celery_app import celery_app


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/ai-config")
async def get_ai_config() -> dict[str, object]:
    config: dict[str, object] = {
        "llm_provider": settings.llm_provider,
        "embedding_provider": settings.embedding_provider,
        "generation_model": settings.active_generation_model,
        "embedding_model": settings.active_embedding_model,
        "generation_temperature": settings.active_generation_temperature,
        "generation_max_tokens": settings.active_generation_max_tokens,
        "enable_reranking": settings.enable_reranking,
        "retrieval_candidates": settings.retrieval_candidates,
        "rerank_top_k": settings.rerank_top_k,
    }
    if settings.llm_provider == "gemini":
        config["gemini_generation_model"] = settings.gemini_generation_model
    return config


@router.get("/ai-health", response_model=None)
async def get_ai_health() -> dict[str, object] | JSONResponse:
    if settings.llm_provider != "ollama" and settings.embedding_provider != "ollama":
        raise AppException(
            message="AI health check is currently implemented for Ollama only",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    try:
        models = await list_ollama_models(settings.ollama_url)
    except httpx.HTTPStatusError as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "provider": "ollama",
                "ollama_base_url": settings.ollama_url,
                "error": f"Ollama returned HTTP {exc.response.status_code}",
                "models": [],
            },
        )
    except httpx.RequestError as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "provider": "ollama",
                "ollama_base_url": settings.ollama_url,
                "error": (
                    "Ollama is not reachable from this service. Start Ollama and make "
                    "sure it is reachable from Docker at OLLAMA_BASE_URL."
                ),
                "models": [],
                "detail": str(exc),
            },
        )

    available_models = [
        model.get("name")
        for model in models
        if isinstance(model, dict) and isinstance(model.get("name"), str)
    ]
    generation_model_available = True
    if settings.llm_provider == "ollama":
        generation_model_available = _model_is_available(
            model_name=settings.ollama_generation_model,
            available_models=available_models,
        )

    embedding_model_available = True
    if settings.embedding_provider == "ollama":
        embedding_model_available = _model_is_available(
            model_name=settings.ollama_embedding_model,
            available_models=available_models,
        )

    warnings: list[str] = []
    if settings.llm_provider == "ollama" and not generation_model_available:
        warnings.append(
            "Generation model is not available. Run "
            f"`ollama pull {settings.ollama_generation_model}`."
        )
    if settings.llm_provider == "gemini" and not settings.gemini_api_key:
        warnings.append("Gemini API key is not configured. Set GEMINI_API_KEY.")
        generation_model_available = False
    if settings.embedding_provider == "ollama" and not embedding_model_available:
        warnings.append(
            "Embedding model is not available. Run "
            f"`ollama pull {settings.ollama_embedding_model}`."
        )

    return {
        "status": "ok",
        "provider": settings.llm_provider,
        "ollama_base_url": settings.ollama_url,
        "generation_model": settings.active_generation_model,
        "embedding_model": settings.active_embedding_model,
        "generation_model_available": generation_model_available,
        "embedding_model_available": embedding_model_available,
        "models": available_models,
        "warnings": warnings,
    }


@router.get("/vector-health")
async def get_vector_health() -> dict[str, object]:
    try:
        return await get_collection_status()
    except VectorStoreError as exc:
        raise AppException(
            message=str(exc),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from exc


@router.get("/ops-health")
async def get_ops_health() -> dict[str, object]:
    redis_health, celery_health, vector_health = await asyncio.gather(
        _check_redis_health(),
        _check_celery_health(),
        _check_qdrant_health(),
    )
    services = [
        _service_health(
            service_id="api",
            label="API",
            status_value="healthy",
            detail="FastAPI is responding.",
        ),
        redis_health,
        celery_health,
        vector_health,
    ]
    degraded_count = sum(1 for service in services if service["status"] == "degraded")
    down_count = sum(1 for service in services if service["status"] == "down")
    overall_status = "down" if down_count else "degraded" if degraded_count else "healthy"
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "status": overall_status,
        "services": services,
    }


def _model_is_available(model_name: str, available_models: list[str]) -> bool:
    return model_name in available_models or f"{model_name}:latest" in available_models


def _service_health(
    *,
    service_id: str,
    label: str,
    status_value: str,
    detail: str,
    latency_ms: float | None = None,
    metadata: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "id": service_id,
        "label": label,
        "status": status_value,
        "detail": detail,
        "latency_ms": latency_ms,
        "metadata": metadata or {},
    }


async def _check_redis_health() -> dict[str, object]:
    started_at = perf_counter()
    client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1)
    try:
        pong = await client.ping()
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        return _service_health(
            service_id="redis",
            label="Redis",
            status_value="healthy" if pong else "degraded",
            detail="Redis accepted a ping." if pong else "Redis ping returned an unexpected value.",
            latency_ms=latency_ms,
        )
    except Exception as exc:
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        return _service_health(
            service_id="redis",
            label="Redis",
            status_value="down",
            detail=str(exc),
            latency_ms=latency_ms,
        )
    finally:
        await client.aclose()


async def _check_celery_health() -> dict[str, object]:
    started_at = perf_counter()
    try:
        stats = await asyncio.to_thread(
            lambda: celery_app.control.inspect(timeout=1.0).stats() or {},
        )
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        worker_count = len(stats)
        return _service_health(
            service_id="celery",
            label="Celery",
            status_value="healthy" if worker_count > 0 else "degraded",
            detail=(
                f"{worker_count} worker{'s' if worker_count != 1 else ''} reporting."
                if worker_count > 0
                else "Broker reachable, but no Celery workers reported stats."
            ),
            latency_ms=latency_ms,
            metadata={"workers": worker_count},
        )
    except Exception as exc:
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        return _service_health(
            service_id="celery",
            label="Celery",
            status_value="down",
            detail=str(exc),
            latency_ms=latency_ms,
        )


async def _check_qdrant_health() -> dict[str, object]:
    started_at = perf_counter()
    try:
        collection = await get_collection_status()
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        collection_status = str(collection.get("status") or "unknown")
        exists = bool(collection.get("exists", True))
        is_healthy = exists and collection_status.lower() not in {"red", "missing", "error"}
        return _service_health(
            service_id="qdrant",
            label="Qdrant",
            status_value="healthy" if is_healthy else "degraded",
            detail=f"Collection status: {collection_status}.",
            latency_ms=latency_ms,
            metadata=collection,
        )
    except Exception as exc:
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        return _service_health(
            service_id="qdrant",
            label="Qdrant",
            status_value="down",
            detail=str(exc),
            latency_ms=latency_ms,
        )
