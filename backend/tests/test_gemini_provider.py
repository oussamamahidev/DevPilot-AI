import httpx
import pytest

from app.providers.base import LLMProviderError
from app.providers.gemini_provider import (
    GEMINI_MISSING_API_KEY_MESSAGE,
    GEMINI_UNAVAILABLE_MESSAGE,
    GeminiLLMProvider,
)


@pytest.mark.asyncio
async def test_gemini_llm_provider_sends_generate_content_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, object]] = []

    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url
            self.timeout = timeout

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            path: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> httpx.Response:
            requests.append(
                {
                    "base_url": self.base_url,
                    "timeout": self.timeout,
                    "path": path,
                    "headers": headers,
                    "json": json,
                }
            )
            return httpx.Response(
                200,
                json={
                    "modelVersion": "gemini-2.5-flash",
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {"text": "DevPilot uses FastAPI and Qdrant [1]."}
                                ]
                            }
                        }
                    ],
                    "usageMetadata": {
                        "promptTokenCount": 11,
                        "candidatesTokenCount": 9,
                        "totalTokenCount": 20,
                    },
                },
                request=httpx.Request("POST", f"{self.base_url}{path}"),
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = GeminiLLMProvider(
        api_key="secret-api-key",
        base_url="https://gemini.test/v1beta",
        model="gemini-2.5-flash",
        timeout=12,
        temperature=0.3,
        max_output_tokens=321,
    )

    response = await provider.generate(
        "Context:\n[1] Source: guide.txt\nContent:\nFastAPI and Qdrant",
        system_prompt="Use only provided context.",
    )

    assert response.content == "DevPilot uses FastAPI and Qdrant [1]."
    assert response.model == "gemini-2.5-flash"
    assert response.prompt_tokens == 11
    assert response.completion_tokens == 9
    assert response.total_tokens == 20
    assert requests == [
        {
            "base_url": "https://gemini.test/v1beta",
            "timeout": 12,
            "path": "/models/gemini-2.5-flash:generateContent",
            "headers": {"x-goog-api-key": "secret-api-key"},
            "json": {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": (
                                    "Context:\n[1] Source: guide.txt\n"
                                    "Content:\nFastAPI and Qdrant"
                                )
                            }
                        ],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 321,
                },
                "system_instruction": {
                    "parts": [{"text": "Use only provided context."}],
                },
            },
        }
    ]
    assert "secret-api-key" not in str(requests[0]["json"])


@pytest.mark.asyncio
async def test_gemini_llm_provider_missing_api_key_returns_clean_error() -> None:
    provider = GeminiLLMProvider(api_key="")

    with pytest.raises(LLMProviderError) as exc_info:
        await provider.generate("Hello")

    assert str(exc_info.value) == GEMINI_MISSING_API_KEY_MESSAGE


@pytest.mark.asyncio
async def test_gemini_llm_provider_timeout_returns_clean_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            path: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> httpx.Response:
            _ = headers, json
            request = httpx.Request("POST", f"{self.base_url}{path}")
            raise httpx.TimeoutException("request timed out", request=request)

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = GeminiLLMProvider(
        api_key="secret-api-key",
        base_url="https://gemini.test/v1beta",
        model="gemini-2.5-flash",
        retry_attempts=0,
        fallback_model=None,
    )

    with pytest.raises(LLMProviderError) as exc_info:
        await provider.generate("Hello")

    assert str(exc_info.value) == GEMINI_UNAVAILABLE_MESSAGE
    assert "secret-api-key" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_gemini_llm_provider_retries_transient_http_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            path: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> httpx.Response:
            nonlocal attempts
            _ = headers, json
            attempts += 1
            request = httpx.Request("POST", f"{self.base_url}{path}")
            if attempts == 1:
                return httpx.Response(503, json={"error": "busy"}, request=request)
            return httpx.Response(
                200,
                json={
                    "modelVersion": "gemini-2.5-flash",
                    "candidates": [
                        {"content": {"parts": [{"text": "Retried successfully."}]}}
                    ],
                    "usageMetadata": {},
                },
                request=request,
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = GeminiLLMProvider(
        api_key="secret-api-key",
        base_url="https://gemini.test/v1beta",
        model="gemini-2.5-flash",
        retry_attempts=1,
        retry_backoff_seconds=0,
    )

    response = await provider.generate("Hello")

    assert response.content == "Retried successfully."
    assert attempts == 2


@pytest.mark.asyncio
async def test_gemini_llm_provider_uses_fallback_model_after_primary_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    paths: list[str] = []

    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            path: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> httpx.Response:
            _ = headers, json
            paths.append(path)
            request = httpx.Request("POST", f"{self.base_url}{path}")
            if "gemini-2.5-flash" in path:
                return httpx.Response(503, json={"error": "busy"}, request=request)
            return httpx.Response(
                200,
                json={
                    "modelVersion": "gemini-2.0-flash",
                    "candidates": [
                        {"content": {"parts": [{"text": "Fallback response."}]}}
                    ],
                    "usageMetadata": {},
                },
                request=request,
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = GeminiLLMProvider(
        api_key="secret-api-key",
        base_url="https://gemini.test/v1beta",
        model="gemini-2.5-flash",
        retry_attempts=1,
        retry_backoff_seconds=0,
        fallback_model="gemini-2.0-flash",
    )

    response = await provider.generate("Hello")

    assert response.content == "Fallback response."
    assert response.model == "gemini-2.0-flash"
    assert paths == [
        "/models/gemini-2.5-flash:generateContent",
        "/models/gemini-2.5-flash:generateContent",
        "/models/gemini-2.0-flash:generateContent",
    ]


@pytest.mark.asyncio
async def test_gemini_llm_provider_does_not_retry_or_fallback_auth_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    paths: list[str] = []

    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            path: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> httpx.Response:
            _ = headers, json
            paths.append(path)
            request = httpx.Request("POST", f"{self.base_url}{path}")
            return httpx.Response(401, json={"error": "unauthorized"}, request=request)

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = GeminiLLMProvider(
        api_key="secret-api-key",
        base_url="https://gemini.test/v1beta",
        model="gemini-2.5-flash",
        retry_attempts=3,
        retry_backoff_seconds=0,
        fallback_model="gemini-2.0-flash",
    )

    with pytest.raises(LLMProviderError) as exc_info:
        await provider.generate("Hello")

    assert str(exc_info.value) == GEMINI_UNAVAILABLE_MESSAGE
    assert paths == ["/models/gemini-2.5-flash:generateContent"]
