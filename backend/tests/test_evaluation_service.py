import pytest

from app.services import evaluation_service


@pytest.mark.asyncio
async def test_evaluate_answer_uses_heuristic_fallback_when_ollama_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_ollama(**kwargs: object) -> dict[str, object]:
        _ = kwargs
        raise RuntimeError("ollama unavailable")

    monkeypatch.setattr(evaluation_service, "_evaluate_with_ollama", fail_ollama)

    result = await evaluation_service.evaluate_answer(
        question="What technologies does DevPilot AI use?",
        answer="DevPilot AI uses FastAPI and PostgreSQL [1].",
        contexts=[
            {
                "filename": "phase12.txt",
                "chunk_index": 0,
                "content": "DevPilot AI uses FastAPI and PostgreSQL.",
            }
        ],
    )

    assert result["relevance"] >= 0.9
    assert result["faithfulness"] >= 0.6
    assert result["context_precision"] == 1.0
    assert result["hallucination_score"] < 0.6
    assert "Heuristic fallback" in result["explanation"]


@pytest.mark.asyncio
async def test_heuristic_relevance_is_high_for_supported_technology_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_ollama(**kwargs: object) -> dict[str, object]:
        _ = kwargs
        raise RuntimeError("ollama unavailable")

    monkeypatch.setattr(evaluation_service, "_evaluate_with_ollama", fail_ollama)

    result = await evaluation_service.evaluate_answer(
        question="What technologies does DevPilot AI use?",
        answer=(
            "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Ollama, "
            "and Qdrant [1]."
        ),
        contexts=[
            {
                "filename": "phase13.txt",
                "chunk_index": 0,
                "content": (
                    "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, "
                    "Ollama, and Qdrant."
                ),
                "score": 0.91,
            }
        ],
    )

    assert result["relevance"] >= 0.9
    assert result["hallucination_score"] <= 0.3


@pytest.mark.asyncio
async def test_heuristic_fallback_keeps_not_found_hallucination_low(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_ollama(**kwargs: object) -> dict[str, object]:
        _ = kwargs
        raise RuntimeError("ollama unavailable")

    monkeypatch.setattr(evaluation_service, "_evaluate_with_ollama", fail_ollama)

    result = await evaluation_service.evaluate_answer(
        question="What is the deployment target?",
        answer="I could not find this information in the uploaded documents.",
        contexts=[],
    )

    assert result["faithfulness"] == 0.8
    assert result["hallucination_score"] == 0.05
