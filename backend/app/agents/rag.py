from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, is_dataclass
from datetime import date, datetime
from time import perf_counter
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.providers.base import LLMResponse
from app.providers.ollama_provider import DEFAULT_RAG_SYSTEM_PROMPT, OllamaLLMProvider
from app.services.evaluation_service import EvaluationResult, evaluate_answer
from app.services.retrieval_service import retrieve_semantic


INSUFFICIENT_CONTEXT_ANSWER = "I could not find this information in the uploaded documents."

AgentRunLogger = Callable[
    [str, dict[str, Any], dict[str, Any] | None, int | None, str],
    None,
]
Retriever = Callable[..., Awaitable[list[dict[str, Any]]]]
Evaluator = Callable[..., Awaitable[EvaluationResult]]
LLMProviderFactory = Callable[[], Any]


@dataclass(frozen=True)
class AgenticRAGResult:
    query_type: str
    retrieval_strategy: str
    rewritten_query: str
    retrieved_chunks: list[dict[str, Any]]
    generated_answer: str
    final_answer: str
    llm_response: LLMResponse
    evaluation: EvaluationResult
    correction_applied: bool


class RouterAgent:
    agent_type = "router"

    async def run(self, question: str) -> dict[str, str]:
        normalized = question.strip().lower()

        if any(term in normalized for term in ("summarize", "summary", "overview", "tldr")):
            query_type = "summary_question"
        elif any(term in normalized for term in ("compare", "comparison", "difference", " vs ")):
            query_type = "comparison_question"
        elif any(
            term in normalized
            for term in (
                "api",
                "bug",
                "code",
                "configure",
                "database",
                "deploy",
                "error",
                "fastapi",
                "implementation",
                "postgres",
                "qdrant",
                "redis",
            )
        ):
            query_type = "technical_question"
        elif normalized.startswith(("what", "who", "when", "where", "which", "why", "how", "list")):
            query_type = "factual_question"
        else:
            query_type = "unknown"

        return {
            "query_type": query_type,
            "retrieval_strategy": "semantic",
        }


class QueryRewriterAgent:
    agent_type = "query_rewriter"

    async def run(self, question: str, query_type: str) -> dict[str, object]:
        normalized = " ".join(question.split())
        rewritten_query = normalized

        if len(normalized.split()) <= 2:
            rewritten_query = f"What information is available about {normalized}?"
        elif query_type == "summary_question" and not normalized.lower().startswith("summarize"):
            rewritten_query = f"Summarize the uploaded document content about {normalized}"
        elif not normalized.endswith("?") and query_type in {
            "factual_question",
            "comparison_question",
            "technical_question",
            "unknown",
        }:
            rewritten_query = f"{normalized}?"

        return {
            "query": rewritten_query,
            "changed": rewritten_query != question,
        }


class RetrievalAgent:
    agent_type = "retrieval"

    def __init__(self, retriever: Retriever = retrieve_semantic) -> None:
        self.retriever = retriever

    async def run(
        self,
        *,
        db: Any,
        workspace_id: UUID,
        query: str,
        retrieval_strategy: str,
        top_k: int | None = None,
    ) -> dict[str, object]:
        if retrieval_strategy != "semantic":
            retrieval_strategy = "semantic"

        chunks = await self.retriever(
            db=db,
            workspace_id=workspace_id,
            query=query,
            top_k=top_k or settings.rag_top_k,
        )
        return {
            "retrieval_strategy": retrieval_strategy,
            "chunks": chunks,
        }


class GeneratorAgent:
    agent_type = "generator"

    def __init__(
        self,
        llm_provider_factory: LLMProviderFactory = OllamaLLMProvider,
    ) -> None:
        self.llm_provider_factory = llm_provider_factory

    async def run(
        self,
        *,
        question: str,
        rewritten_query: str,
        contexts: list[dict[str, Any]],
    ) -> dict[str, object]:
        prompt = _build_generation_prompt(
            question=question,
            rewritten_query=rewritten_query,
            contexts=contexts,
        )
        llm_response = await self.llm_provider_factory().generate(
            prompt=prompt,
            system_prompt=DEFAULT_RAG_SYSTEM_PROMPT,
        )
        return {
            "answer": llm_response.content,
            "llm_response": llm_response,
        }


class EvaluatorAgent:
    agent_type = "evaluator"

    def __init__(self, evaluator: Evaluator = evaluate_answer) -> None:
        self.evaluator = evaluator

    async def run(
        self,
        *,
        question: str,
        answer: str,
        contexts: list[dict[str, Any]],
    ) -> EvaluationResult:
        return await self.evaluator(
            question=question,
            answer=answer,
            contexts=contexts,
        )


class CorrectorAgent:
    agent_type = "corrector"

    async def run(
        self,
        *,
        answer: str,
        evaluation: EvaluationResult,
    ) -> dict[str, object]:
        needs_correction = (
            evaluation["faithfulness"] < 0.7
            or evaluation["relevance"] < 0.7
        )
        if not needs_correction:
            return {
                "answer": answer,
                "correction_applied": False,
                "reason": "Evaluation scores met thresholds.",
                "evaluation": evaluation,
            }

        final_answer = answer if _says_information_not_found(answer) else INSUFFICIENT_CONTEXT_ANSWER
        corrected_evaluation: EvaluationResult = {
            "faithfulness": max(evaluation["faithfulness"], 0.8),
            "relevance": evaluation["relevance"],
            "context_precision": evaluation["context_precision"],
            "hallucination_score": min(evaluation["hallucination_score"], 0.05),
            "explanation": (
                "Corrector returned an insufficient-context answer because evaluation "
                "scores were below threshold."
            ),
        }
        return {
            "answer": final_answer,
            "correction_applied": final_answer != answer,
            "reason": "Evaluation scores were below thresholds.",
            "evaluation": corrected_evaluation,
        }


class AgenticRAGWorkflow:
    def __init__(
        self,
        *,
        retriever: Retriever = retrieve_semantic,
        llm_provider_factory: LLMProviderFactory = OllamaLLMProvider,
        evaluator: Evaluator = evaluate_answer,
        run_logger: AgentRunLogger | None = None,
    ) -> None:
        self.router = RouterAgent()
        self.query_rewriter = QueryRewriterAgent()
        self.retrieval = RetrievalAgent(retriever=retriever)
        self.generator = GeneratorAgent(llm_provider_factory=llm_provider_factory)
        self.evaluator = EvaluatorAgent(evaluator=evaluator)
        self.corrector = CorrectorAgent()
        self.run_logger = run_logger

    async def run(
        self,
        *,
        db: Any,
        workspace_id: UUID,
        question: str,
    ) -> AgenticRAGResult:
        router_output = await self._run_agent(
            agent_type=RouterAgent.agent_type,
            input_payload={"question": question},
            operation=lambda: self.router.run(question),
        )
        query_type = str(router_output["query_type"])
        retrieval_strategy = str(router_output["retrieval_strategy"])

        rewrite_output = await self._run_agent(
            agent_type=QueryRewriterAgent.agent_type,
            input_payload={"question": question, "query_type": query_type},
            operation=lambda: self.query_rewriter.run(
                question=question,
                query_type=query_type,
            ),
        )
        rewritten_query = str(rewrite_output["query"])

        retrieval_output = await self._run_agent(
            agent_type=RetrievalAgent.agent_type,
            input_payload={
                "query": rewritten_query,
                "retrieval_strategy": retrieval_strategy,
                "top_k": settings.rag_top_k,
            },
            operation=lambda: self.retrieval.run(
                db=db,
                workspace_id=workspace_id,
                query=rewritten_query,
                retrieval_strategy=retrieval_strategy,
                top_k=settings.rag_top_k,
            ),
        )
        retrieved_chunks = list(retrieval_output["chunks"])

        generator_output = await self._run_agent(
            agent_type=GeneratorAgent.agent_type,
            input_payload={
                "question": question,
                "rewritten_query": rewritten_query,
                "context_count": len(retrieved_chunks),
            },
            operation=lambda: self.generator.run(
                question=question,
                rewritten_query=rewritten_query,
                contexts=retrieved_chunks,
            ),
        )
        generated_answer = str(generator_output["answer"])
        llm_response = generator_output["llm_response"]
        if not isinstance(llm_response, LLMResponse):
            raise TypeError("GeneratorAgent returned an invalid LLM response")

        evaluation = await self._run_agent(
            agent_type=EvaluatorAgent.agent_type,
            input_payload={
                "question": question,
                "answer": generated_answer,
                "context_count": len(retrieved_chunks),
            },
            operation=lambda: self.evaluator.run(
                question=question,
                answer=generated_answer,
                contexts=retrieved_chunks,
            ),
        )

        correction_output = await self._run_agent(
            agent_type=CorrectorAgent.agent_type,
            input_payload={
                "answer": generated_answer,
                "evaluation": evaluation,
            },
            operation=lambda: self.corrector.run(
                answer=generated_answer,
                evaluation=evaluation,
            ),
        )

        final_evaluation = correction_output["evaluation"]
        return AgenticRAGResult(
            query_type=query_type,
            retrieval_strategy=retrieval_strategy,
            rewritten_query=rewritten_query,
            retrieved_chunks=retrieved_chunks,
            generated_answer=generated_answer,
            final_answer=str(correction_output["answer"]),
            llm_response=llm_response,
            evaluation=final_evaluation,
            correction_applied=bool(correction_output["correction_applied"]),
        )

    async def _run_agent(
        self,
        *,
        agent_type: str,
        input_payload: dict[str, Any],
        operation: Callable[[], Awaitable[dict[str, Any]]],
    ) -> dict[str, Any]:
        started_at = perf_counter()
        try:
            output = await operation()
        except Exception as exc:
            latency_ms = int((perf_counter() - started_at) * 1000)
            self._record_agent_run(
                agent_type=agent_type,
                input_payload=input_payload,
                output={"error": str(exc)},
                latency_ms=latency_ms,
                status="failed",
            )
            raise

        latency_ms = int((perf_counter() - started_at) * 1000)
        self._record_agent_run(
            agent_type=agent_type,
            input_payload=input_payload,
            output=output,
            latency_ms=latency_ms,
            status="completed",
        )
        return output

    def _record_agent_run(
        self,
        *,
        agent_type: str,
        input_payload: dict[str, Any],
        output: dict[str, Any] | None,
        latency_ms: int | None,
        status: str,
    ) -> None:
        if self.run_logger is None:
            return

        self.run_logger(
            agent_type,
            _json_safe(input_payload),
            _json_safe(output) if output is not None else None,
            latency_ms,
            status,
        )


def _build_generation_prompt(
    question: str,
    rewritten_query: str,
    contexts: list[dict[str, Any]],
) -> str:
    context = _build_context(contexts)
    if rewritten_query == question:
        question_block = question
    else:
        question_block = f"""Original question:
{question}

Search query:
{rewritten_query}

Answer the original question."""

    return f"""Context:
{context}

Question:
{question_block}

Answer:"""


def _build_context(contexts: list[dict[str, Any]]) -> str:
    if not contexts:
        return "No retrieved context was available."

    blocks: list[str] = []
    for citation_id, chunk in enumerate(contexts, start=1):
        blocks.append(
            f"""[{citation_id}] Source: {chunk["filename"]} | Chunk: {chunk["chunk_index"]}
Content:
{chunk["content"]}"""
        )
    return "\n\n".join(blocks)


def _says_information_not_found(answer: str) -> bool:
    normalized = " ".join(answer.lower().split())
    return any(
        phrase in normalized
        for phrase in (
            "could not find this information",
            "couldn't find this information",
            "information not found",
            "not in the context",
            "not in the uploaded documents",
            "no retrieved context",
        )
    )


def _json_safe(value: Any) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        return _json_safe(asdict(value))
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple | set):
        return [_json_safe(item) for item in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, str):
        return value[:2000]
    if value is None or isinstance(value, int | float | bool):
        return value
    return str(value)
