import pytest

from app.providers.base import LLMProviderError
from app.providers.factory import get_llm_provider, settings
from app.providers.gemini_provider import GeminiLLMProvider
from app.providers.ollama_provider import OllamaLLMProvider


def test_get_llm_provider_returns_gemini_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "llm_provider", "gemini")

    assert isinstance(get_llm_provider(), GeminiLLMProvider)


def test_get_llm_provider_returns_ollama_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "llm_provider", "ollama")

    assert isinstance(get_llm_provider(), OllamaLLMProvider)


def test_get_llm_provider_rejects_unknown_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "llm_provider", "unknown")

    with pytest.raises(LLMProviderError) as exc_info:
        get_llm_provider()

    assert "Set LLM_PROVIDER to either `gemini` or `ollama`" in str(exc_info.value)
