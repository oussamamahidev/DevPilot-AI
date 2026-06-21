from functools import lru_cache
from typing import Any

from pydantic import AnyHttpUrl, Field, ValidationInfo, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(min_length=1)
    app_env: str = Field(min_length=1)
    secret_key: str = Field(min_length=32)

    postgres_user: str = Field(min_length=1)
    postgres_password: str = Field(min_length=1)
    postgres_db: str = Field(min_length=1)
    postgres_host: str = Field(min_length=1)
    postgres_port: int = Field(gt=0, le=65535)
    database_url: str = Field(min_length=1)

    redis_url: str = Field(min_length=1)
    qdrant_url: AnyHttpUrl

    llm_provider: str = Field(default="ollama", min_length=1)
    embedding_provider: str = Field(default="ollama", min_length=1)
    ollama_base_url: AnyHttpUrl = "http://host.docker.internal:11434"
    ollama_generation_model: str = Field(default="qwen2.5:3b-instruct-q3_K_S", min_length=1)
    ollama_chat_think: bool = Field(default=False)
    ollama_embedding_model: str = Field(default="nomic-embed-text", min_length=1)
    ollama_embedding_timeout_seconds: float = Field(default=120.0, gt=0)
    gemini_api_key: str | None = None
    gemini_generation_model: str = Field(default="gemini-2.5-flash", min_length=1)
    gemini_timeout_seconds: float = Field(default=60.0, gt=0)
    gemini_max_output_tokens: int = Field(default=1000, gt=0)
    gemini_temperature: float = Field(default=0.2, ge=0, le=2)
    gemini_max_retries: int = Field(default=3, ge=0)
    gemini_retry_backoff_seconds: float = Field(default=2.0, ge=0)
    gemini_fallback_model: str | None = Field(default="gemini-2.0-flash")
    embedding_dimension: int = Field(default=768, gt=0)
    embedding_batch_size: int = Field(default=4, gt=0)
    generation_temperature: float = Field(default=0.2, ge=0, le=2)
    generation_max_tokens: int = Field(default=1000, gt=0)
    rag_top_k: int = Field(default=5, gt=0, le=20)
    rag_max_context_chars: int = Field(default=6000, gt=0)
    enable_reranking: bool = Field(default=True)
    enable_ollama_reranker: bool = Field(default=False)
    retrieval_candidates: int = Field(default=15, gt=0, le=50)
    rerank_top_k: int = Field(default=5, gt=0, le=20)
    max_upload_size: int = Field(default=10 * 1024 * 1024, gt=0)

    openai_api_key: str | None = None
    openai_generation_model: str | None = None
    openai_embedding_model: str | None = None

    frontend_url: AnyHttpUrl
    backend_cors_origins: str = Field(min_length=1)

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith(("postgresql://", "postgresql+asyncpg://")):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection URL")
        return value

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: str) -> str:
        if not value.startswith("redis://"):
            raise ValueError("REDIS_URL must be a Redis connection URL")
        return value

    @field_validator("llm_provider")
    @classmethod
    def validate_llm_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"ollama", "openai", "gemini"}:
            raise ValueError("LLM provider must be one of: ollama, openai, gemini")
        return normalized

    @field_validator("embedding_provider")
    @classmethod
    def validate_embedding_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"ollama", "openai"}:
            raise ValueError("Embedding provider must be one of: ollama, openai")
        return normalized

    @field_validator("backend_cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str, _: ValidationInfo) -> str:
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        if not origins:
            raise ValueError("BACKEND_CORS_ORIGINS must contain at least one origin")
        return value

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]

    @computed_field
    @property
    def service_name(self) -> str:
        return "DevPilot AI API"

    @computed_field
    @property
    def ollama_url(self) -> str:
        return str(self.ollama_base_url).rstrip("/")

    @computed_field
    @property
    def active_generation_model(self) -> str:
        if self.llm_provider == "gemini":
            return self.gemini_generation_model
        if self.llm_provider == "openai" and self.openai_generation_model:
            return self.openai_generation_model
        return self.ollama_generation_model

    @computed_field
    @property
    def active_generation_temperature(self) -> float:
        if self.llm_provider == "gemini":
            return self.gemini_temperature
        return self.generation_temperature

    @computed_field
    @property
    def active_generation_max_tokens(self) -> int:
        if self.llm_provider == "gemini":
            return self.gemini_max_output_tokens
        return self.generation_max_tokens

    @computed_field
    @property
    def active_embedding_model(self) -> str:
        if self.embedding_provider == "openai" and self.openai_embedding_model:
            return self.openai_embedding_model
        return self.ollama_embedding_model

    def safe_log_context(self) -> dict[str, Any]:
        return {
            "app_name": self.app_name,
            "app_env": self.app_env,
            "postgres_host": self.postgres_host,
            "postgres_port": self.postgres_port,
            "postgres_db": self.postgres_db,
            "redis_url": self.redis_url,
            "qdrant_url": str(self.qdrant_url),
            "llm_provider": self.llm_provider,
            "embedding_provider": self.embedding_provider,
            "ollama_base_url": self.ollama_url,
            "ollama_generation_model": self.ollama_generation_model,
            "ollama_chat_think": self.ollama_chat_think,
            "ollama_embedding_model": self.ollama_embedding_model,
            "ollama_embedding_timeout_seconds": self.ollama_embedding_timeout_seconds,
            "gemini_generation_model": self.gemini_generation_model,
            "gemini_timeout_seconds": self.gemini_timeout_seconds,
            "gemini_max_output_tokens": self.gemini_max_output_tokens,
            "gemini_temperature": self.gemini_temperature,
            "gemini_max_retries": self.gemini_max_retries,
            "gemini_retry_backoff_seconds": self.gemini_retry_backoff_seconds,
            "gemini_fallback_model": self.gemini_fallback_model,
            "embedding_dimension": self.embedding_dimension,
            "embedding_batch_size": self.embedding_batch_size,
            "generation_temperature": self.generation_temperature,
            "generation_max_tokens": self.generation_max_tokens,
            "rag_top_k": self.rag_top_k,
            "rag_max_context_chars": self.rag_max_context_chars,
            "enable_reranking": self.enable_reranking,
            "enable_ollama_reranker": self.enable_ollama_reranker,
            "retrieval_candidates": self.retrieval_candidates,
            "rerank_top_k": self.rerank_top_k,
            "max_upload_size": self.max_upload_size,
            "frontend_url": str(self.frontend_url),
            "cors_origins": self.cors_origins,
        }

    def safe_ai_log_context(self) -> dict[str, Any]:
        return {
            "llm_provider": self.llm_provider,
            "embedding_provider": self.embedding_provider,
            "ollama_base_url": self.ollama_url,
            "ollama_generation_model": self.ollama_generation_model,
            "ollama_chat_think": self.ollama_chat_think,
            "ollama_embedding_model": self.ollama_embedding_model,
            "ollama_embedding_timeout_seconds": self.ollama_embedding_timeout_seconds,
            "gemini_generation_model": self.gemini_generation_model,
            "gemini_timeout_seconds": self.gemini_timeout_seconds,
            "gemini_max_output_tokens": self.gemini_max_output_tokens,
            "gemini_temperature": self.gemini_temperature,
            "gemini_max_retries": self.gemini_max_retries,
            "gemini_retry_backoff_seconds": self.gemini_retry_backoff_seconds,
            "gemini_fallback_model": self.gemini_fallback_model,
            "generation_model": self.active_generation_model,
            "embedding_model": self.active_embedding_model,
            "embedding_batch_size": self.embedding_batch_size,
            "generation_temperature": self.active_generation_temperature,
            "generation_max_tokens": self.active_generation_max_tokens,
            "enable_reranking": self.enable_reranking,
            "enable_ollama_reranker": self.enable_ollama_reranker,
            "retrieval_candidates": self.retrieval_candidates,
            "rerank_top_k": self.rerank_top_k,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()

def get_safe_log_context() -> dict[str, Any]:
    return get_settings().safe_log_context()
settings = get_settings()
