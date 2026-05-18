from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
import logging
from time import perf_counter
from typing import Any

import httpx

from app.core.config import settings
from app.providers.base import LLMProviderError, LLMResponse
from app.providers.ollama_provider import DEFAULT_RAG_SYSTEM_PROMPT


GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_UNAVAILABLE_MESSAGE = (
    "Gemini generation is temporarily unavailable. Please retry later or switch "
    "LLM_PROVIDER=ollama."
)
GEMINI_MISSING_API_KEY_MESSAGE = (
    "GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in .env to use "
    "Gemini generation."
)
GEMINI_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
GEMINI_NON_RETRYABLE_STATUS_CODES = {400, 401, 403}

logger = logging.getLogger(__name__)


class _GeminiModelFailure(RuntimeError):
    def __init__(
        self,
        *,
        error_category: str,
        status_code: int | None = None,
        allow_fallback: bool = True,
    ) -> None:
        super().__init__(error_category)
        self.error_category = error_category
        self.status_code = status_code
        self.allow_fallback = allow_fallback


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
        retry_attempts: int | None = None,
        retry_backoff_seconds: float | None = None,
        fallback_model: str | None = None,
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
        self.retry_attempts = max(
            retry_attempts if retry_attempts is not None else settings.gemini_max_retries,
            0,
        )
        self.retry_backoff_seconds = max(
            retry_backoff_seconds
            if retry_backoff_seconds is not None
            else settings.gemini_retry_backoff_seconds,
            0,
        )
        fallback_source = (
            fallback_model if fallback_model is not None else settings.gemini_fallback_model
        )
        self.fallback_model = fallback_source.strip() if fallback_source else None

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

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
            response, selected_model = await self._post_with_fallback(
                client=client,
                payload=payload,
            )

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
            model=model if isinstance(model, str) else selected_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=elapsed_ms,
        )

    async def _post_with_fallback(
        self,
        *,
        client: httpx.AsyncClient,
        payload: dict[str, object],
    ) -> tuple[httpx.Response, str]:
        last_failure: _GeminiModelFailure | None = None
        models = list(self._models_to_try())

        for index, model in enumerate(models):
            try:
                return (
                    await self._post_model_with_retries(
                        client=client,
                        payload=payload,
                        model=model,
                    ),
                    model,
                )
            except _GeminiModelFailure as exc:
                last_failure = exc
                has_fallback = index + 1 < len(models)
                if not has_fallback or not exc.allow_fallback:
                    raise LLMProviderError(GEMINI_UNAVAILABLE_MESSAGE) from exc
                fallback_model = models[index + 1]
                _log_gemini_event(
                    message="Gemini generation switching to fallback model",
                    level=logging.WARNING,
                    model=fallback_model,
                    attempt_number=0,
                    status_code=exc.status_code,
                    error_category=f"fallback_after_{exc.error_category}",
                )

        raise LLMProviderError(GEMINI_UNAVAILABLE_MESSAGE) from last_failure

    async def _post_model_with_retries(
        self,
        *,
        client: httpx.AsyncClient,
        payload: dict[str, object],
        model: str,
    ) -> httpx.Response:
        for attempt in range(self.retry_attempts + 1):
            attempt_number = attempt + 1
            try:
                response = await client.post(
                    f"/models/{model}:generateContent",
                    headers={"x-goog-api-key": self.api_key},
                    json=payload,
                )
                response.raise_for_status()
                return response
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                error_category = _error_category_for_status(status_code)
                _log_gemini_event(
                    message="Gemini generation request failed",
                    level=logging.WARNING,
                    model=model,
                    attempt_number=attempt_number,
                    status_code=status_code,
                    error_category=error_category,
                )
                if _should_not_retry_status(status_code):
                    raise _GeminiModelFailure(
                        error_category=error_category,
                        status_code=status_code,
                        allow_fallback=False,
                    ) from exc
                if not _should_retry_status(status_code):
                    raise _GeminiModelFailure(
                        error_category=error_category,
                        status_code=status_code,
                    ) from exc
                if attempt >= self.retry_attempts:
                    raise _GeminiModelFailure(
                        error_category=error_category,
                        status_code=status_code,
                    ) from exc
                await asyncio.sleep(
                    _retry_delay(exc.response, attempt, self.retry_backoff_seconds)
                )
            except (httpx.TimeoutException, httpx.RequestError) as exc:
                error_category = (
                    "timeout" if isinstance(exc, httpx.TimeoutException) else "request_error"
                )
                _log_gemini_event(
                    message="Gemini generation request failed",
                    level=logging.WARNING,
                    model=model,
                    attempt_number=attempt_number,
                    status_code=None,
                    error_category=error_category,
                )
                if attempt >= self.retry_attempts:
                    raise _GeminiModelFailure(error_category=error_category) from exc
                await asyncio.sleep(_retry_delay(None, attempt, self.retry_backoff_seconds))

        raise _GeminiModelFailure(error_category="unknown")

    def _models_to_try(self) -> Sequence[str]:
        models = [self.model]
        if self.fallback_model and self.fallback_model != self.model:
            models.append(self.fallback_model)
        return models

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


def _should_retry_status(status_code: int) -> bool:
    return status_code in GEMINI_RETRYABLE_STATUS_CODES


def _should_not_retry_status(status_code: int) -> bool:
    return status_code in GEMINI_NON_RETRYABLE_STATUS_CODES


def _error_category_for_status(status_code: int) -> str:
    if status_code == 429:
        return "rate_limited"
    if status_code in {500, 502, 503, 504}:
        return "transient_http_status"
    if status_code in GEMINI_NON_RETRYABLE_STATUS_CODES:
        return "configuration_or_auth"
    return "http_status"


def _log_gemini_event(
    *,
    message: str,
    level: int,
    model: str,
    attempt_number: int,
    status_code: int | None,
    error_category: str,
) -> None:
    logger.log(
        level,
        message,
        extra={
            "provider": "gemini",
            "model": model,
            "attempt_number": attempt_number,
            "status_code": status_code,
            "error_category": error_category,
        },
    )


def _retry_delay(
    response: httpx.Response | None,
    attempt: int,
    retry_backoff_seconds: float,
) -> float:
    if response is not None:
        retry_after = response.headers.get("retry-after")
        if retry_after is not None:
            try:
                return min(float(retry_after), 5.0)
            except ValueError:
                pass
    return min(retry_backoff_seconds * (2**attempt), 5.0)


def _int_value(data: Any, key: str) -> int:
    if not isinstance(data, dict):
        return 0
    value = data.get(key)
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    return 0
