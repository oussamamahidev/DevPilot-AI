from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.providers.base import LLMProviderError
from app.providers.gemini_provider import GeminiLLMProvider
from app.providers.ollama_provider import OllamaLLMProvider


def get_llm_provider() -> Any:
    if settings.llm_provider == "ollama":
        return OllamaLLMProvider()
    if settings.llm_provider == "gemini":
        return GeminiLLMProvider()

    raise LLMProviderError(f"Unsupported LLM provider: {settings.llm_provider}")
