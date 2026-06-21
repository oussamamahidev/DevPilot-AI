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
CELERY_QDRANT_CONTEXT = (
    "Celery handles asynchronous document processing in DevPilot AI. Redis is the "
    "queue broker for Celery workers. Qdrant stores vector embeddings and supports "
    "semantic search over document chunks."
)
CELERY_QDRANT_ANSWER = (
    "Celery runs asynchronous document processing jobs, Redis acts as the queue "
    "broker, and Qdrant stores embeddings for semantic search [1]."
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
async def test_corrector_keeps_supported_technology_answer_when_evaluator_is_wrong() -> None:
    result = await CorrectorAgent().run(
        question="Which technologies does DevPilot AI use?",
        answer=TECH_ANSWER,
        evaluation={
            "faithfulness": 1.0,
            "relevance": 0.0,
            "context_precision": 0.0,
            "hallucination_score": 1.0,
            "explanation": "Incorrect LLM evaluator response.",
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
    assert "Technology terms" in result["reason"]


@pytest.mark.asyncio
async def test_corrector_keeps_medium_relevance_answer_with_strong_context() -> None:
    result = await CorrectorAgent().run(
        question="How does Celery and Qdrant work in DevPilot AI?",
        answer=CELERY_QDRANT_ANSWER,
        evaluation={
            "faithfulness": 0.8,
            "relevance": 0.6,
            "context_precision": 1.0,
            "hallucination_score": 0.05,
            "explanation": "Medium relevance but grounded answer.",
        },
        contexts=[
            {
                "filename": "rerank_relevant.txt",
                "chunk_index": 0,
                "content": CELERY_QDRANT_CONTEXT,
                "score": 0.016,
                "metadata": {
                    "rerank_score": 0.782362,
                    "overlap": 0.6,
                    "exact_matches": 3,
                    "original_rank": 1,
                    "original_score": 0.016,
                },
            }
        ],
    )

    assert result["answer"] == CELERY_QDRANT_ANSWER
    assert result["correction_applied"] is False
    assert "retrieved context is strong" in result["evaluation"]["explanation"]  # type: ignore[index]


@pytest.mark.asyncio
async def test_corrector_refuses_unrelated_question_with_weak_context() -> None:
    result = await CorrectorAgent().run(
        question="What is the CEO favorite food?",
        answer="The CEO favorite food is sushi [1].",
        evaluation={
            "faithfulness": 0.4,
            "relevance": 0.2,
            "context_precision": 0.3,
            "hallucination_score": 0.75,
            "explanation": "Unsupported answer.",
        },
        contexts=[
            {
                "filename": "rerank_relevant.txt",
                "chunk_index": 0,
                "content": CELERY_QDRANT_CONTEXT,
                "score": 0.016,
            }
        ],
    )

    assert result["answer"] == "I could not find this information in the uploaded documents."
    assert result["correction_applied"] is True


@pytest.mark.asyncio
async def test_corrector_replaces_false_refusal_when_context_matches_question() -> None:
    result = await CorrectorAgent().run(
        question="What technologies does DevPilot AI use?",
        answer="I could not find this information in the uploaded documents.",
        evaluation={
            "faithfulness": 0.8,
            "relevance": 0.1,
            "context_precision": 1.0,
            "hallucination_score": 0.05,
            "explanation": "The model refused.",
        },
        contexts=[
            {
                "filename": "project-stack.txt",
                "chunk_index": 0,
                "content": (
                    "DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, "
                    "Qdrant, Ollama embeddings, and Gemini generation."
                ),
                "score": 0.75,
            }
        ],
    )

    assert result["correction_applied"] is True
    assert "FastAPI" in result["answer"]
    assert "Qdrant" in result["answer"]
    assert "[1]" in result["answer"]
    assert "refusal" in result["reason"]


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


@pytest.mark.asyncio
async def test_workflow_respects_explicit_retrieval_strategy_override() -> None:
    async def fake_retriever(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["strategy"] == "keyword"
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
            "relevance": 0.8,
            "context_precision": 1.0,
            "hallucination_score": 0.05,
            "explanation": "Grounded answer.",
        }

    async def fake_reranker(**kwargs: object) -> list[dict[str, object]]:
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
        retrieval_strategy="keyword",
    )

    assert result.retrieval_strategy == "keyword"
    assert result.final_answer == TECH_ANSWER


@pytest.mark.asyncio
async def test_workflow_keeps_celery_qdrant_answer_after_reranking() -> None:
    agent_runs: list[dict[str, object]] = []
    relevant_chunk_id = uuid4()

    async def fake_retriever(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["query"] == "How does Celery and Qdrant work in DevPilot AI?"
        assert kwargs["strategy"] == "hybrid"
        assert kwargs["top_k"] == 15
        return [
            {
                "chunk_id": uuid4(),
                "document_id": uuid4(),
                "filename": "rerank_irrelevant.txt",
                "content": "The office has lunch schedules and unrelated project notes.",
                "chunk_index": 0,
                "score": 0.02,
                "metadata": {"original_rank": 1},
            },
            {
                "chunk_id": relevant_chunk_id,
                "document_id": uuid4(),
                "filename": "rerank_relevant.txt",
                "content": CELERY_QDRANT_CONTEXT,
                "chunk_index": 0,
                "score": 0.016,
                "metadata": {"original_rank": 2},
            },
        ]

    async def fake_reranker(**kwargs: object) -> list[dict[str, object]]:
        assert kwargs["query"] == "How does Celery and Qdrant work in DevPilot AI?"
        contexts = list(kwargs["contexts"])  # type: ignore[arg-type]
        relevant = next(item for item in contexts if item["filename"] == "rerank_relevant.txt")
        irrelevant = next(item for item in contexts if item["filename"] == "rerank_irrelevant.txt")
        relevant["score"] = 0.782362
        relevant["metadata"] = {
            **dict(relevant["metadata"]),
            "rerank_score": 0.782362,
            "overlap": 0.6,
            "exact_matches": 3,
            "original_rank": 2,
            "original_score": 0.016,
        }
        irrelevant["score"] = 0.575344
        irrelevant["metadata"] = {
            **dict(irrelevant["metadata"]),
            "rerank_score": 0.575344,
            "overlap": 0.4,
            "exact_matches": 2,
            "original_rank": 1,
            "original_score": 0.02,
        }
        return [relevant, irrelevant]

    class FakeLLMProvider:
        async def generate(self, prompt: str, system_prompt: str) -> LLMResponse:
            assert "rerank_relevant.txt" in prompt
            assert "Celery handles asynchronous document processing" in prompt
            assert "private-document assistant" in system_prompt
            return LLMResponse(
                content=CELERY_QDRANT_ANSWER,
                model="test-model",
                prompt_tokens=18,
                completion_tokens=20,
                total_tokens=38,
                latency_ms=42,
            )

    async def fake_evaluator(**kwargs: object) -> dict[str, object]:
        assert kwargs["answer"] == CELERY_QDRANT_ANSWER
        return {
            "faithfulness": 0.8,
            "relevance": 0.6,
            "context_precision": 1.0,
            "hallucination_score": 0.05,
            "explanation": "Medium relevance but grounded answer.",
        }

    def fake_run_logger(
        agent_type: str,
        input_payload: dict[str, object],
        output_payload: dict[str, object] | None,
        latency_ms: int | None,
        status: str,
    ) -> None:
        agent_runs.append(
            {
                "agent_type": agent_type,
                "input": input_payload,
                "output": output_payload,
                "latency_ms": latency_ms,
                "status": status,
            }
        )

    workflow = AgenticRAGWorkflow(
        retriever=fake_retriever,
        reranker=fake_reranker,
        llm_provider_factory=lambda: FakeLLMProvider(),
        evaluator=fake_evaluator,
        run_logger=fake_run_logger,
    )

    result = await workflow.run(
        db=None,
        workspace_id=uuid4(),
        question="How does Celery and Qdrant work in DevPilot AI?",
    )

    assert result.final_answer == CELERY_QDRANT_ANSWER
    assert "Celery" in result.final_answer
    assert "Redis" in result.final_answer
    assert "Qdrant" in result.final_answer
    assert result.retrieved_chunks[0]["filename"] == "rerank_relevant.txt"
    assert result.correction_applied is False
    assert result.evaluation["faithfulness"] == 0.8
    assert any(
        run["agent_type"] == "corrector" and run["status"] == "completed"
        for run in agent_runs
    )
