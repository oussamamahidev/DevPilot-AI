import httpx
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.ai.ollama import list_ollama_models
from app.services.vector_store_service import VectorStoreError, get_collection_status


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


def _model_is_available(model_name: str, available_models: list[str]) -> bool:
    return model_name in available_models or f"{model_name}:latest" in available_models
