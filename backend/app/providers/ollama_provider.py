from __future__ import annotations

from collections.abc import Sequence
from time import perf_counter

import httpx

from app.core.config import settings
from app.providers.base import (
    BaseEmbeddingProvider,
    EmbeddingProviderError,
    EmbeddingResponse,
    LLMProviderError,
    LLMResponse,
)


DEFAULT_RAG_SYSTEM_PROMPT = """You are DevPilot AI, a private-document assistant.
Answer the user's question using ONLY the provided context.
If the answer is not in the context, say:
"I could not find this information in the uploaded documents."
Always cite sources using [1], [2], [3].
Do not invent facts.
Answer in the same language as the user."""


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        self.base_url = (base_url or settings.ollama_url).rstrip("/")
        self.model = model or settings.active_embedding_model
        self.timeout = timeout

    async def embed(self, text: str) -> list[float]:
        embeddings = await self.embed_batch([text])
        if not embeddings:
            raise EmbeddingProviderError("Ollama returned no embedding")
        return embeddings[0]

    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []

        input_value: str | list[str] = texts[0] if len(texts) == 1 else list(texts)
        response = await self._request_embeddings(input_value)

        if len(response.embeddings) != len(texts):
            raise EmbeddingProviderError(
                "Ollama returned an unexpected embedding count "
                f"expected={len(texts)} actual={len(response.embeddings)}"
            )
        return response.embeddings

    async def _request_embeddings(self, input_value: str | list[str]) -> EmbeddingResponse:
        payload = {
            "model": self.model,
            "input": input_value,
        }

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.post("/api/embed", json=payload)
                response.raise_for_status()
        except httpx.ConnectError as exc:
            raise EmbeddingProviderError(
                "Ollama is not reachable. Run `ollama serve` and pull the embedding model "
                f"with `ollama pull {self.model}`."
            ) from exc
        except httpx.TimeoutException as exc:
            raise EmbeddingProviderError(
                "Ollama embedding request timed out. Confirm Ollama is running and the "
                f"`{self.model}` model is available."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise EmbeddingProviderError(
                f"Ollama returned HTTP {exc.response.status_code}. Confirm the embedding "
                f"model is available with `ollama pull {self.model}`."
            ) from exc
        except httpx.RequestError as exc:
            raise EmbeddingProviderError(
                "Ollama embedding request failed. Run `ollama serve` and pull the embedding "
                f"model with `ollama pull {self.model}`."
            ) from exc

        data = response.json()
        embeddings = data.get("embeddings")
        if embeddings is None and "embedding" in data:
            embeddings = [data["embedding"]]

        if not isinstance(embeddings, list):
            raise EmbeddingProviderError("Ollama returned an invalid embedding response")

        normalized_embeddings: list[list[float]] = []
        for embedding in embeddings:
            if not isinstance(embedding, list):
                raise EmbeddingProviderError("Ollama returned an invalid embedding vector")
            normalized_embeddings.append([float(value) for value in embedding])

        model = data.get("model")
        return EmbeddingResponse(
            model=model if isinstance(model, str) else self.model,
            embeddings=normalized_embeddings,
        )


class OllamaLLMProvider:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        self.base_url = (base_url or settings.ollama_url).rstrip("/")
        self.model = model or settings.ollama_generation_model
        self.timeout = timeout

    async def generate(
        self,
        prompt: str,
        system_prompt: str = DEFAULT_RAG_SYSTEM_PROMPT,
    ) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "think": settings.ollama_chat_think,
            "options": {
                "temperature": settings.generation_temperature,
                "num_predict": settings.generation_max_tokens,
            },
        }
        started_at = perf_counter()

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.post("/api/chat", json=payload)
                response.raise_for_status()
        except httpx.ConnectError as exc:
            raise LLMProviderError(
                "Ollama generation is unavailable or timed out. Please check that Ollama "
                f"is running and the selected model is installed: {self.model}."
            ) from exc
        except httpx.TimeoutException as exc:
            raise LLMProviderError(
                "Ollama generation is unavailable or timed out. Please check that Ollama "
                f"is running and the selected model is installed: {self.model}."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(
                f"Ollama returned HTTP {exc.response.status_code}. Confirm the generation "
                f"model is available with `ollama pull {self.model}`."
            ) from exc
        except httpx.RequestError as exc:
            raise LLMProviderError(
                "Ollama generation is unavailable or timed out. Please check that Ollama "
                f"is running and the selected model is installed: {self.model}."
            ) from exc

        elapsed_ms = int((perf_counter() - started_at) * 1000)
        data = response.json()
        message = data.get("message")
        content = ""
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            content = message["content"].strip()

        if not content:
            if isinstance(message, dict) and message.get("thinking"):
                raise LLMProviderError(
                    "Ollama returned only thinking output and no answer content. "
                    "Set OLLAMA_CHAT_THINK=false for qwen3 chat models."
                )
            raise LLMProviderError("Ollama returned an empty chat response")

        prompt_tokens = _int_or_zero(data.get("prompt_eval_count"))
        completion_tokens = _int_or_zero(data.get("eval_count"))
        total_tokens = prompt_tokens + completion_tokens

        return LLMResponse(
            content=content,
            model=data.get("model") if isinstance(data.get("model"), str) else self.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=elapsed_ms,
        )


def _int_or_zero(value: object) -> int:
    return value if isinstance(value, int) else 0
