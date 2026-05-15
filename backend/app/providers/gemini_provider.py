from __future__ import annotations

from collections.abc import Mapping, Sequence
from time import perf_counter
from typing import Any

import httpx

from app.core.config import settings
from app.providers.base import LLMProviderError, LLMResponse
from app.providers.ollama_provider import DEFAULT_RAG_SYSTEM_PROMPT


GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_UNAVAILABLE_MESSAGE = (
    "Gemini generation is unavailable or timed out. Please check "
    "GEMINI_API_KEY and GEMINI_GENERATION_MODEL."
)
GEMINI_MISSING_API_KEY_MESSAGE = (
    "GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in .env to use "
    "Gemini generation."
)


class GeminiLLMProvider:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str = GEMINI_BASE_URL,
        model: str | None = None,
        timeout: float | None = None,
        temperature: float | None = None,
        max_output_tokens: int | None = None,
    ) -> None:
        raw_api_key = api_key if api_key is not None else settings.gemini_api_key
        self.api_key = raw_api_key.strip() if raw_api_key else ""
        self.base_url = base_url.rstrip("/")
        self.model = model or settings.gemini_generation_model
        self.timeout = timeout if timeout is not None else settings.gemini_timeout_seconds
        self.temperature = (
            temperature if temperature is not None else settings.gemini_temperature
        )
        self.max_output_tokens = (
            max_output_tokens
            if max_output_tokens is not None
            else settings.gemini_max_output_tokens
        )

    async def generate(
        self,
        prompt: str,
        system_prompt: str = DEFAULT_RAG_SYSTEM_PROMPT,
    ) -> LLMResponse:
        return await self.generate_messages(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
        )

    async def generate_messages(
        self,
        messages: Sequence[Mapping[str, str]],
        system_prompt: str | None = DEFAULT_RAG_SYSTEM_PROMPT,
    ) -> LLMResponse:
        if not self.api_key:
            raise LLMProviderError(GEMINI_MISSING_API_KEY_MESSAGE)

        payload = self._build_payload(messages=messages, system_prompt=system_prompt)
        started_at = perf_counter()

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.post(
                    f"/models/{self.model}:generateContent",
                    headers={"x-goog-api-key": self.api_key},
                    json=payload,
                )
                response.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            raise LLMProviderError(GEMINI_UNAVAILABLE_MESSAGE) from exc

        elapsed_ms = int((perf_counter() - started_at) * 1000)

        try:
            data = response.json()
        except ValueError as exc:
            raise LLMProviderError(GEMINI_UNAVAILABLE_MESSAGE) from exc

        content = _extract_text(data)
        if not content:
            raise LLMProviderError(GEMINI_UNAVAILABLE_MESSAGE)

        usage = data.get("usageMetadata")
        prompt_tokens = _int_value(usage, "promptTokenCount")
        completion_tokens = _int_value(usage, "candidatesTokenCount")
        total_tokens = _int_value(usage, "totalTokenCount") or (
            prompt_tokens + completion_tokens
        )
        model = data.get("modelVersion")

        return LLMResponse(
            content=content,
            model=model if isinstance(model, str) else self.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=elapsed_ms,
        )

    def _build_payload(
        self,
        *,
        messages: Sequence[Mapping[str, str]],
        system_prompt: str | None,
    ) -> dict[str, object]:
        contents = [_content_from_message(message) for message in messages]
        contents = [content for content in contents if content is not None]
        if not contents:
            raise LLMProviderError("Gemini generation requires at least one message.")

        payload: dict[str, object] = {
            "contents": contents,
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": self.max_output_tokens,
            },
        }
        if system_prompt and system_prompt.strip():
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt.strip()}],
            }
        return payload


def _content_from_message(message: Mapping[str, str]) -> dict[str, object] | None:
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        return None

    role = str(message.get("role", "user")).strip().lower()
    gemini_role = "model" if role in {"assistant", "model"} else "user"
    return {
        "role": gemini_role,
        "parts": [{"text": content}],
    }


def _extract_text(data: Any) -> str:
    if not isinstance(data, dict):
        return ""

    text_parts: list[str] = []
    candidates = data.get("candidates")
    if not isinstance(candidates, list):
        return ""

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        for part in parts:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                text_parts.append(part["text"])

    return "".join(text_parts).strip()


def _int_value(data: Any, key: str) -> int:
    if not isinstance(data, dict):
        return 0
    value = data.get(key)
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    return 0
