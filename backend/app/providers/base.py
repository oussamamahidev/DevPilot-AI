from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class EmbeddingResponse:
    model: str
    embeddings: list[list[float]]


class EmbeddingProviderError(RuntimeError):
    """Raised when an embedding provider cannot create embeddings."""


class EmbeddingProviderTimeoutError(EmbeddingProviderError):
    """Raised when an embedding provider request times out."""


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int | None = None


class LLMProviderError(RuntimeError):
    """Raised when an LLM provider cannot generate a response."""


async def chunk_text(text: str, *, chunk_size: int = 24) -> AsyncIterator[str]:
    """Yield text in small chunks for providers without native streaming."""

    normalized_chunk_size = max(chunk_size, 1)
    for start in range(0, len(text), normalized_chunk_size):
        chunk = text[start : start + normalized_chunk_size]
        if chunk:
            yield chunk


class BaseEmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError

    @abstractmethod
    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        raise NotImplementedError
