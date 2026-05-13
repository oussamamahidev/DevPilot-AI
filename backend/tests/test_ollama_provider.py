import httpx
import pytest

from app.providers.base import EmbeddingProviderError, LLMProviderError
from app.providers.ollama_provider import DEFAULT_RAG_SYSTEM_PROMPT, OllamaEmbeddingProvider, OllamaLLMProvider


@pytest.mark.asyncio
async def test_ollama_embedding_provider_sends_batch_request(monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[dict[str, object]] = []

    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url
            self.timeout = timeout

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(self, path: str, json: dict[str, object]) -> httpx.Response:
            requests.append({"base_url": self.base_url, "path": path, "json": json})
            return httpx.Response(
                200,
                json={"model": "nomic-embed-text", "embeddings": [[0.1, 0.2], [0.3, 0.4]]},
                request=httpx.Request("POST", f"{self.base_url}{path}"),
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = OllamaEmbeddingProvider(
        base_url="http://ollama:11434",
        model="nomic-embed-text",
    )

    embeddings = await provider.embed_batch(["first", "second"])

    assert embeddings == [[0.1, 0.2], [0.3, 0.4]]
    assert requests == [
        {
            "base_url": "http://ollama:11434",
            "path": "/api/embed",
            "json": {"model": "nomic-embed-text", "input": ["first", "second"]},
        }
    ]


@pytest.mark.asyncio
async def test_ollama_embedding_provider_unreachable_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(self, path: str, json: dict[str, object]) -> httpx.Response:
            request = httpx.Request("POST", f"{self.base_url}{path}")
            raise httpx.ConnectError("connection refused", request=request)

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = OllamaEmbeddingProvider(
        base_url="http://ollama:11434",
        model="nomic-embed-text",
    )

    with pytest.raises(EmbeddingProviderError) as exc_info:
        await provider.embed("hello")

    assert "ollama serve" in str(exc_info.value)
    assert "ollama pull nomic-embed-text" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_llm_provider_sends_chat_request(monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[dict[str, object]] = []

    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url
            self.timeout = timeout

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(self, path: str, json: dict[str, object]) -> httpx.Response:
            requests.append({"base_url": self.base_url, "path": path, "json": json})
            return httpx.Response(
                200,
                json={
                    "model": "qwen3:8b",
                    "message": {"role": "assistant", "content": "DevPilot uses FastAPI [1]."},
                    "prompt_eval_count": 12,
                    "eval_count": 8,
                },
                request=httpx.Request("POST", f"{self.base_url}{path}"),
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = OllamaLLMProvider(
        base_url="http://ollama:11434",
        model="qwen3:8b",
    )
    response = await provider.generate("Context:\n[1] Source: guide.txt | Chunk: 0\nContent:\nFastAPI")

    assert response.content == "DevPilot uses FastAPI [1]."
    assert response.model == "qwen3:8b"
    assert response.prompt_tokens == 12
    assert response.completion_tokens == 8
    assert response.total_tokens == 20
    assert requests[0]["base_url"] == "http://ollama:11434"
    assert requests[0]["path"] == "/api/chat"
    payload = requests[0]["json"]
    assert payload["model"] == "qwen3:8b"
    assert payload["stream"] is False
    assert payload["think"] is False
    assert payload["messages"][0] == {"role": "system", "content": DEFAULT_RAG_SYSTEM_PROMPT}
    assert payload["messages"][1]["role"] == "user"
    assert "[1] Source: guide.txt | Chunk: 0" in payload["messages"][1]["content"]
    assert "Content:" in payload["messages"][1]["content"]
    assert payload["options"]["temperature"] == 0.2
    assert payload["options"]["num_predict"] == 1000


def test_default_rag_system_prompt_uses_phase_11_guardrails() -> None:
    assert "private-document assistant" in DEFAULT_RAG_SYSTEM_PROMPT
    assert "using ONLY the provided context" in DEFAULT_RAG_SYSTEM_PROMPT
    assert "I could not find this information in the uploaded documents." in DEFAULT_RAG_SYSTEM_PROMPT
    assert "Always cite sources using [1], [2], [3]." in DEFAULT_RAG_SYSTEM_PROMPT
    assert "Do not invent facts." in DEFAULT_RAG_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_ollama_llm_provider_timeout_returns_clean_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(self, path: str, json: dict[str, object]) -> httpx.Response:
            request = httpx.Request("POST", f"{self.base_url}{path}")
            raise httpx.TimeoutException("request timed out", request=request)

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    provider = OllamaLLMProvider(
        base_url="http://ollama:11434",
        model="qwen3:8b",
    )

    with pytest.raises(LLMProviderError) as exc_info:
        await provider.generate("Context:\nNo retrieved context was available.\n\nQuestion:\nHello\n\nAnswer:")

    assert "Ollama generation is unavailable or timed out" in str(exc_info.value)
    assert "qwen3:8b" in str(exc_info.value)
