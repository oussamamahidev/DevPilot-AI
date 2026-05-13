from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from collections.abc import Sequence


@dataclass(frozen=True)
class EmbeddingResponse:
    model: str
    embeddings: list[list[float]]


class EmbeddingProviderError(RuntimeError):
    """Raised when an embedding provider cannot create embeddings."""


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


class BaseEmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError

    @abstractmethod
    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        raise NotImplementedError
