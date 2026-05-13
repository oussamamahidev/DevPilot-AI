from uuid import uuid4

import pytest

from app.agents.rag import AgenticRAGWorkflow, CorrectorAgent, QueryRewriterAgent, RouterAgent
from app.providers.base import LLMResponse


TECH_CONTEXT = (
    "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Ollama, and Qdrant."
)
TECH_ANSWER = (
    "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Ollama, and Qdrant [1]."
)


@pytest.mark.asyncio
async def test_router_classifies_summary_and_uses_semantic_retrieval() -> None:
    result = await RouterAgent().run("Summarize the uploaded architecture document")

    assert result == {
        "query_type": "summary_question",
        "retrieval_strategy": "hybrid",
    }


@pytest.mark.asyncio
async def test_router_uses_hybrid_for_technical_questions() -> None:
    result = await RouterAgent().run("What technologies does DevPilot AI use?")

    assert result == {
        "query_type": "technical_question",
        "retrieval_strategy": "hybrid",
    }


@pytest.mark.asyncio
async def test_router_uses_keyword_for_exact_terms() -> None:
    result = await RouterAgent().run('"Qdrant vector search"')

    assert result == {
        "query_type": "unknown",
        "retrieval_strategy": "keyword",
    }


@pytest.mark.asyncio
async def test_query_rewriter_cleans_short_unclear_query() -> None:
    result = await QueryRewriterAgent().run("  Redis  ", "unknown")

    assert result["query"] == "What information is available about Redis?"
    assert result["changed"] is True


@pytest.mark.asyncio
async def test_corrector_returns_insufficient_context_answer_for_low_scores() -> None:
    result = await CorrectorAgent().run(
        answer="The company office is in Paris.",
        evaluation={
            "faithfulness": 0.2,
            "relevance": 0.8,
            "context_precision": 0.3,
            "hallucination_score": 0.9,
            "explanation": "Unsupported answer.",
        },
        contexts=[
            {
                "filename": "phase13.txt",
                "chunk_index": 0,
                "content": TECH_CONTEXT,
                "score": 0.92,
            }
        ],
    )

    assert result["answer"] == "I could not find this information in the uploaded documents."
    assert result["correction_applied"] is True
    assert result["evaluation"]["hallucination_score"] == 0.05  # type: ignore[index]


@pytest.mark.asyncio
async def test_corrector_keeps_grounded_answer_when_only_relevance_is_low() -> None:
    result = await CorrectorAgent().run(
        answer=TECH_ANSWER,
        evaluation={
            "faithfulness": 0.85,
            "relevance": 0.25,
            "context_precision": 1.0,
            "hallucination_score": 0.05,
            "explanation": "Heuristic relevance was low.",
        },
        contexts=[
            {
                "filename": "phase13.txt",
                "chunk_index": 0,
                "content": TECH_CONTEXT,
                "score": 0.91,
            }
        ],
    )

    assert result["answer"] == TECH_ANSWER
    assert result["correction_applied"] is False
    assert "retrieved context is strong" in result["evaluation"]["explanation"]  # type: ignore[index]


@pytest.mark.asyncio
async def test_workflow_does_not_replace_valid_technology_answer_on_low_relevance() -> None:
    async def fake_retriever(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["query"] == "What technologies does DevPilot AI use?"
        assert kwargs["strategy"] == "hybrid"
        assert kwargs["top_k"] == 15
        return [
            {
                "chunk_id": uuid4(),
                "document_id": uuid4(),
                "filename": "phase13.txt",
                "content": TECH_CONTEXT,
                "chunk_index": 0,
                "score": 0.91,
                "metadata": {},
            }
        ]

    class FakeLLMProvider:
        async def generate(self, prompt: str, system_prompt: str) -> LLMResponse:
            assert "FastAPI, PostgreSQL, Redis, Celery, Ollama, and Qdrant" in prompt
            assert "private-document assistant" in system_prompt
            return LLMResponse(
                content=TECH_ANSWER,
                model="test-model",
                prompt_tokens=10,
                completion_tokens=12,
                total_tokens=22,
                latency_ms=50,
            )

    async def fake_evaluator(**kwargs: object) -> dict[str, object]:
        assert kwargs["answer"] == TECH_ANSWER
        return {
            "faithfulness": 0.85,
            "relevance": 0.25,
            "context_precision": 1.0,
            "hallucination_score": 0.05,
            "explanation": "Heuristic relevance was low.",
        }

    async def fake_reranker(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["query"] == "What technologies does DevPilot AI use?"
        assert kwargs["top_k"] == 5
        assert len(kwargs["contexts"]) == 1  # type: ignore[arg-type]
        return list(kwargs["contexts"])  # type: ignore[arg-type]

    workflow = AgenticRAGWorkflow(
        retriever=fake_retriever,
        reranker=fake_reranker,
        llm_provider_factory=lambda: FakeLLMProvider(),
        evaluator=fake_evaluator,
    )

    result = await workflow.run(
        db=None,
        workspace_id=uuid4(),
        question="What technologies does DevPilot AI use?",
    )

    assert result.final_answer == TECH_ANSWER
    assert "FastAPI" in result.final_answer
    assert "PostgreSQL" in result.final_answer
    assert "Qdrant" in result.final_answer
    assert result.correction_applied is False
    assert result.evaluation["hallucination_score"] == 0.05
