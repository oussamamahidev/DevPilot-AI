import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.api.routes.health import health_check
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.metrics import initialize_metric_labels
from app.core.observability import RequestObservabilityMiddleware, metrics_response


configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    initialize_metric_labels(
        llm_provider=settings.llm_provider,
        llm_model=settings.active_generation_model,
    )
    logger.info("Application startup", extra=settings.safe_log_context())
    logger.info(
        "Backend AI configuration llm_provider=%s generation_model=%s "
        "embedding_provider=%s embedding_model=%s generation_max_tokens=%s",
        settings.llm_provider,
        settings.active_generation_model,
        settings.embedding_provider,
        settings.active_embedding_model,
        settings.active_generation_max_tokens,
        extra=settings.safe_ai_log_context(),
    )
    yield
    logger.info("Application shutdown", extra={"service": settings.service_name})


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestObservabilityMiddleware)

    register_exception_handlers(app)
    app.include_router(api_router)
    app.add_api_route("/health", health_check, methods=["GET"], tags=["health"])
    app.add_api_route("/metrics", metrics_response, methods=["GET"], tags=["metrics"])

    return app


app = create_app()
