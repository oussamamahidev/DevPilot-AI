import logging

from celery import Celery
from celery.signals import worker_ready

from app.core.config import settings


logger = logging.getLogger(__name__)

celery_app = Celery(
    "devpilot",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.document_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)


@worker_ready.connect
def log_worker_ai_configuration(**_: object) -> None:
    logger.info(
        "Celery worker AI configuration llm_provider=%s embedding_provider=%s ollama_base_url=%s "
        "ollama_generation_model=%s ollama_embedding_model=%s generation_max_tokens=%s",
        settings.llm_provider,
        settings.embedding_provider,
        settings.ollama_url,
        settings.ollama_generation_model,
        settings.ollama_embedding_model,
        settings.generation_max_tokens,
        extra=settings.safe_ai_log_context(),
    )
