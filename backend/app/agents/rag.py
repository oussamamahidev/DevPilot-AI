from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, is_dataclass
from datetime import date, datetime
import re
from time import perf_counter
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.providers.base import LLMResponse
from app.providers.factory import get_llm_provider
from app.providers.ollama_provider import DEFAULT_RAG_SYSTEM_PROMPT
from app.services.evaluation_service import EvaluationResult, evaluate_answer
from app.services.reranking_service import rerank
from app.services.retrieval_service import retrieve_chunks


INSUFFICIENT_CONTEXT_ANSWER = "I could not find this information in the uploaded documents."

AgentRunLogger = Callable[
    [str, dict[str, Any], dict[str, Any] | None, int | None, str],
    None,
]
Retriever = Callable[..., Awaitable[list[dict[str, Any]]]]
Reranker = Callable[..., Awaitable[list[dict[str, Any]]]]
Evaluator = Callable[..., Awaitable[EvaluationResult]]
LLMProviderFactory = Callable[[], Any]


@dataclass(frozen=True)
class AgenticRAGResult:
    query_type: str
    retrieval_strategy: str
    rewritten_query: str
    candidate_chunks: list[dict[str, Any]]
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

        if _looks_like_exact_term_query(normalized):
            query_type = "unknown"
            retrieval_strategy = "keyword"
        elif any(term in normalized for term in ("summarize", "summary", "overview", "tldr")):
            query_type = "summary_question"
            retrieval_strategy = "hybrid"
        elif any(term in normalized for term in ("compare", "comparison", "difference", " vs ")):
            query_type = "comparison_question"
            retrieval_strategy = "hybrid"
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
                "technical",
                "technologies",
                "technology",
            )
        ):
            query_type = "technical_question"
            retrieval_strategy = "hybrid"
        elif normalized.startswith(("what", "who", "when", "where", "which", "why", "how", "list")):
            query_type = "factual_question"
            retrieval_strategy = "hybrid"
        else:
            query_type = "unknown"
            retrieval_strategy = "semantic"

        return {
            "query_type": query_type,
            "retrieval_strategy": retrieval_strategy,
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

    def __init__(self, retriever: Retriever = retrieve_chunks) -> None:
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
        chunks = await self.retriever(
            db=db,
            workspace_id=workspace_id,
            query=query,
            top_k=top_k or settings.rag_top_k,
            strategy=retrieval_strategy,
        )
        return {
            "retrieval_strategy": retrieval_strategy,
            "chunks": chunks,
        }


class RerankerAgent:
    agent_type = "reranker"

    def __init__(self, reranker: Reranker = rerank) -> None:
        self.reranker = reranker

    async def run(
        self,
        *,
        query: str,
        contexts: list[dict[str, Any]],
        top_k: int,
    ) -> dict[str, object]:
        reranked_contexts = await self.reranker(
            query=query,
            contexts=contexts,
            top_k=top_k,
        )
        return {
            "chunks": reranked_contexts,
            "input_count": len(contexts),
            "top_k": top_k,
        }


class GeneratorAgent:
    agent_type = "generator"

    def __init__(
        self,
        llm_provider_factory: LLMProviderFactory = get_llm_provider,
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
        answer = _ensure_answer_has_citation(llm_response.content, contexts)
        return {
            "answer": answer,
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
        contexts: list[dict[str, Any]],
        question: str = "",
    ) -> dict[str, object]:
        should_replace, reason = _should_replace_with_insufficient_context(
            question=question,
            answer=answer,
            evaluation=evaluation,
            contexts=contexts,
        )
        if not should_replace:
            corrected_evaluation = evaluation
            if (
                evaluation["relevance"] < 0.7
                and evaluation["faithfulness"] >= 0.7
                and evaluation["context_precision"] >= 0.8
                and evaluation["hallucination_score"] <= 0.3
                and contexts
            ):
                corrected_evaluation = {
                    **evaluation,
                    "explanation": (
                        f"{evaluation['explanation']} Corrector kept the original answer because "
                        "the retrieved context is strong and hallucination risk is low."
                    ),
                }
            return {
                "answer": answer,
                "correction_applied": False,
                "reason": reason,
                "evaluation": corrected_evaluation,
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
            "reason": reason,
            "evaluation": corrected_evaluation,
        }


class AgenticRAGWorkflow:
    def __init__(
        self,
        *,
        retriever: Retriever = retrieve_chunks,
        reranker: Reranker = rerank,
        llm_provider_factory: LLMProviderFactory = get_llm_provider,
        evaluator: Evaluator = evaluate_answer,
        run_logger: AgentRunLogger | None = None,
    ) -> None:
        self.router = RouterAgent()
        self.query_rewriter = QueryRewriterAgent()
        self.retrieval = RetrievalAgent(retriever=retriever)
        self.reranker = RerankerAgent(reranker=reranker)
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
                "top_k": _candidate_top_k(),
            },
            operation=lambda: self.retrieval.run(
                db=db,
                workspace_id=workspace_id,
                query=rewritten_query,
                retrieval_strategy=retrieval_strategy,
                top_k=_candidate_top_k(),
            ),
        )
        candidate_chunks = list(retrieval_output["chunks"])

        if settings.enable_reranking:
            reranking_output = await self._run_agent(
                agent_type=RerankerAgent.agent_type,
                input_payload={
                    "query": rewritten_query,
                    "candidate_count": len(candidate_chunks),
                    "top_k": settings.rerank_top_k,
                },
                operation=lambda: self.reranker.run(
                    query=rewritten_query,
                    contexts=candidate_chunks,
                    top_k=settings.rerank_top_k,
                ),
            )
            retrieved_chunks = list(reranking_output["chunks"])
        else:
            retrieved_chunks = candidate_chunks[: settings.rag_top_k]

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
                "context_count": len(retrieved_chunks),
                "top_retrieval_score": _top_retrieval_score(retrieved_chunks),
            },
            operation=lambda: self.corrector.run(
                answer=generated_answer,
                evaluation=evaluation,
                contexts=retrieved_chunks,
                question=question,
            ),
        )

        final_evaluation = correction_output["evaluation"]
        return AgenticRAGResult(
            query_type=query_type,
            retrieval_strategy=retrieval_strategy,
            rewritten_query=rewritten_query,
            candidate_chunks=candidate_chunks,
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


def _looks_like_exact_term_query(normalized_question: str) -> bool:
    if '"' in normalized_question or "'" in normalized_question or "`" in normalized_question:
        return True
    question_starters = ("what", "who", "when", "where", "which", "why", "how", "explain", "summarize")
    words = normalized_question.split()
    return bool(words) and len(words) <= 3 and not normalized_question.startswith(question_starters)


def _candidate_top_k() -> int:
    if not settings.enable_reranking:
        return settings.rag_top_k
    return max(settings.retrieval_candidates, settings.rerank_top_k, settings.rag_top_k)


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


def _should_replace_with_insufficient_context(
    *,
    question: str,
    answer: str,
    evaluation: EvaluationResult,
    contexts: list[dict[str, Any]],
) -> tuple[bool, str]:
    if not contexts:
        return True, "No citations were available."

    if _is_technology_stack_question(question) and _answer_technical_terms_are_supported(
        answer=answer,
        contexts=contexts,
    ):
        return False, "Technology terms in the answer are present in retrieved context."

    if evaluation["faithfulness"] < 0.5:
        return True, "Faithfulness was below the replacement threshold."

    if evaluation["hallucination_score"] > 0.6:
        return True, "Hallucination score was above the replacement threshold."

    if _technical_terms_are_supported(
        question=question,
        contexts=contexts,
    ):
        return False, "Technical terms from the question are present in retrieved context."

    if evaluation["context_precision"] < 0.5:
        return True, "Context precision was below the replacement threshold."

    if _answer_is_supported_despite_medium_or_low_relevance(
        evaluation=evaluation,
        contexts=contexts,
    ):
        return False, "Context support is strong and hallucination risk is low."

    if 0.5 <= evaluation["relevance"] < 0.7:
        return False, "Relevance was medium, not a refusal condition."

    return False, "No hard insufficient-context condition was met."


def _answer_is_supported_despite_medium_or_low_relevance(
    *,
    evaluation: EvaluationResult,
    contexts: list[dict[str, Any]],
) -> bool:
    return (
        bool(contexts)
        and evaluation["context_precision"] >= 0.8
        and evaluation["hallucination_score"] <= 0.3
        and evaluation["faithfulness"] >= 0.7
    )


def _technical_terms_are_supported(
    *,
    question: str,
    contexts: list[dict[str, Any]],
) -> bool:
    terms = _technical_terms(question)
    if not terms:
        return False

    context_text = " ".join(str(context.get("content", "")) for context in contexts)
    return bool(terms & _technical_terms(context_text))


def _answer_technical_terms_are_supported(
    *,
    answer: str,
    contexts: list[dict[str, Any]],
) -> bool:
    answer_terms = _technical_terms(answer)
    if not answer_terms:
        return False

    context_text = " ".join(str(context.get("content", "")) for context in contexts)
    context_terms = _technical_terms(context_text)
    return answer_terms <= context_terms


def _is_technology_stack_question(question: str) -> bool:
    normalized = " ".join(question.lower().split())
    technology_markers = (
        "technologies",
        "technology",
        "tech stack",
        "stack",
        "tools",
        "frameworks",
        "libraries",
        "built with",
        "powered by",
    )
    use_markers = (" use", " uses", " using", " built", " run on")
    return any(marker in normalized for marker in technology_markers) and (
        any(marker in normalized for marker in use_markers)
        or "technolog" in normalized
        or "stack" in normalized
    )


def _technical_terms(text: str) -> set[str]:
    exact_terms = {
        "alembic",
        "asyncpg",
        "celery",
        "docker",
        "fastapi",
        "gemini",
        "jwt",
        "next",
        "nextjs",
        "openai",
        "ollama",
        "postgres",
        "postgresql",
        "pydantic",
        "python",
        "qdrant",
        "redis",
        "sqlalchemy",
    }
    normalized = text.lower().replace("next.js", "nextjs").replace("docker compose", "docker")
    return {term for term in exact_terms if re.search(rf"\b{re.escape(term)}\b", normalized)}


def _ensure_answer_has_citation(answer: str, contexts: list[dict[str, Any]]) -> str:
    stripped = answer.strip()
    if not stripped or not contexts or _says_information_not_found(stripped):
        return stripped
    if re.search(r"\[\d+\]", stripped):
        return stripped
    if stripped[-1] in ".!?":
        return f"{stripped[:-1]} [1]{stripped[-1]}"
    return f"{stripped} [1]"


def _top_retrieval_score(contexts: list[dict[str, Any]]) -> float:
    scores: list[float] = []
    for context in contexts:
        try:
            scores.append(float(context.get("score", 0.0)))
        except (TypeError, ValueError):
            continue
        metadata = context.get("metadata")
        if isinstance(metadata, dict):
            source_scores = metadata.get("source_scores")
            if isinstance(source_scores, dict):
                for score in source_scores.values():
                    try:
                        scores.append(float(score))
                    except (TypeError, ValueError):
                        continue
    return max(scores, default=0.0)


def _has_citation_marker(answer: str) -> bool:
    return bool(re.search(r"\[\d+\]", answer))


def _claims_facts(answer: str) -> bool:
    if _says_information_not_found(answer):
        return False
    words = answer.split()
    if len(words) < 4:
        return False
    factual_markers = (
        " is ",
        " are ",
        " uses ",
        " use ",
        " has ",
        " have ",
        " supports ",
        " contains ",
        " includes ",
        " was ",
        " were ",
    )
    normalized = f" {answer.lower()} "
    return any(marker in normalized for marker in factual_markers)


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
