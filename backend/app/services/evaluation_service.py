from __future__ import annotations

import json
import re
from time import perf_counter
from typing import Any, TypedDict
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.metrics import EVALUATION_LATENCY_SECONDS
from app.models.conversation import Conversation, Evaluation, Message
from app.models.workspace import WorkspaceMember
from app.providers.base import LLMProviderError


class EvaluationResult(TypedDict):
    faithfulness: float
    relevance: float
    context_precision: float
    hallucination_score: float
    explanation: str


class EvaluationNotFoundError(RuntimeError):
    pass


async def evaluate_answer(
    question: str,
    answer: str,
    contexts: list[dict[str, Any] | str],
) -> EvaluationResult:
    started_at = perf_counter()
    status = "heuristic"
    try:
        if settings.llm_provider == "ollama":
            status = "llm"
            return await _evaluate_with_ollama(
                question=question,
                answer=answer,
                contexts=contexts,
            )
        return _evaluate_with_heuristics(question=question, answer=answer, contexts=contexts)
    except Exception:
        status = "heuristic"
        try:
            return _evaluate_with_heuristics(question=question, answer=answer, contexts=contexts)
        except Exception:
            status = "error"
            raise
    finally:
        EVALUATION_LATENCY_SECONDS.labels(status=status).observe(perf_counter() - started_at)


async def get_message_evaluation(
    db: AsyncSession,
    message_id: UUID,
    user_id: UUID,
    is_admin: bool = False,
) -> Evaluation:
    statement = (
        select(Evaluation)
        .join(Message, Evaluation.message_id == Message.id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Message.id == message_id)
        .order_by(Evaluation.created_at.desc())
    )
    if not is_admin:
        statement = statement.join(
            WorkspaceMember,
            WorkspaceMember.workspace_id == Conversation.workspace_id,
        ).where(WorkspaceMember.user_id == user_id)

    evaluation = await db.scalar(statement)
    if evaluation is None:
        raise EvaluationNotFoundError("Evaluation not found or access denied")
    return evaluation


async def _evaluate_with_ollama(
    question: str,
    answer: str,
    contexts: list[dict[str, Any] | str],
) -> EvaluationResult:
    context_text = _build_context_text(contexts)
    system_prompt = (
        "You are an answer evaluator. Return only valid JSON with numeric scores from "
        "0.0 to 1.0. Do not include markdown or commentary."
    )
    user_prompt = f"""Evaluate the answer against the provided context.

Scoring:
- faithfulness: supported by the context
- relevance: answers the question
- context_precision: retrieved context is useful for the question
- hallucination_score: unsupported answer content, where 0 means none and 1 means severe
- explanation: one brief sentence

Context:
{context_text}

Question:
{question}

Answer:
{answer}

Return exactly this JSON object:
{{
  "faithfulness": 0.0,
  "relevance": 0.0,
  "context_precision": 0.0,
  "hallucination_score": 0.0,
  "explanation": "brief reason"
}}"""

    payload = {
        "model": settings.ollama_generation_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "format": "json",
        "think": settings.ollama_chat_think,
        "options": {
            "temperature": 0,
            "num_predict": 250,
        },
    }

    try:
        async with httpx.AsyncClient(base_url=settings.ollama_url, timeout=45.0) as client:
            response = await client.post("/api/chat", json=payload)
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise LLMProviderError("Ollama evaluation request failed") from exc

    data = response.json()
    message = data.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise LLMProviderError("Ollama returned an invalid evaluation response")

    return _parse_evaluation_json(message["content"])


def _parse_evaluation_json(content: str) -> EvaluationResult:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        start = content.find("{")
        end = content.rfind("}")
        if start < 0 or end <= start:
            raise LLMProviderError("Ollama returned non-JSON evaluation content") from exc
        payload = json.loads(content[start : end + 1])

    if not isinstance(payload, dict):
        raise LLMProviderError("Ollama evaluation JSON was not an object")

    explanation = payload.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        explanation = "LLM evaluation completed."

    return {
        "faithfulness": _coerce_score(payload.get("faithfulness")),
        "relevance": _coerce_score(payload.get("relevance")),
        "context_precision": _coerce_score(payload.get("context_precision")),
        "hallucination_score": _coerce_score(payload.get("hallucination_score")),
        "explanation": explanation.strip(),
    }


def _evaluate_with_heuristics(
    question: str,
    answer: str,
    contexts: list[dict[str, Any] | str],
) -> EvaluationResult:
    question_words = _keywords(question)
    answer_words = _keywords(answer)
    context_text = _build_context_text(contexts)
    context_words = _keywords(context_text)

    answer_context_overlap = _overlap_score(answer_words, context_words)
    relevance = _estimate_relevance(
        question=question,
        answer=answer,
        context_text=context_text,
        question_words=question_words,
        answer_words=answer_words,
        answer_context_overlap=answer_context_overlap,
    )
    context_precision = _estimate_context_precision(question_words, contexts)

    not_found = _says_information_not_found(answer)
    has_citation = bool(re.search(r"\[\d+\]", answer))

    if not_found:
        faithfulness = 0.8
        hallucination_score = 0.05
    elif has_citation:
        faithfulness = max(0.6, min(0.85, 0.55 + (answer_context_overlap * 0.3)))
        hallucination_score = max(0.1, min(0.6, 0.65 - (answer_context_overlap * 0.4)))
    else:
        faithfulness = min(0.55, answer_context_overlap)
        hallucination_score = max(0.35, min(0.9, 1.0 - answer_context_overlap))

    return {
        "faithfulness": _round_score(faithfulness),
        "relevance": _round_score(relevance),
        "context_precision": _round_score(context_precision),
        "hallucination_score": _round_score(hallucination_score),
        "explanation": "Heuristic fallback used because LLM evaluation was unavailable.",
    }


def _build_context_text(contexts: list[dict[str, Any] | str]) -> str:
    if not contexts:
        return "No retrieved context was available."

    blocks: list[str] = []
    for index, context in enumerate(contexts, start=1):
        if isinstance(context, dict):
            filename = context.get("filename", "unknown")
            chunk_index = context.get("chunk_index", "unknown")
            content = str(context.get("content", ""))
            blocks.append(
                f"[{index}] Source: {filename} | Chunk: {chunk_index}\nContent:\n{content}"
            )
        else:
            blocks.append(f"[{index}] {context}")

    text = "\n\n".join(blocks).strip()
    return text[: settings.rag_max_context_chars]


def _keywords(text: str) -> set[str]:
    stop_words = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "did",
        "do",
        "does",
        "for",
        "from",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "use",
        "used",
        "uses",
        "using",
        "was",
        "what",
        "with",
    }
    words = re.findall(r"[a-zA-Z0-9_]{3,}", text.lower())
    return {word for word in words if word not in stop_words}


def _estimate_relevance(
    *,
    question: str,
    answer: str,
    context_text: str,
    question_words: set[str],
    answer_words: set[str],
    answer_context_overlap: float,
) -> float:
    relevance = max(
        _overlap_score(question_words, answer_words),
        _overlap_score(_expanded_terms(question_words), _expanded_terms(answer_words)),
    )

    if _is_technology_question(question):
        supported_technology_terms = _technology_terms(answer) & _technology_terms(context_text)
        if len(supported_technology_terms) >= 2:
            relevance = max(relevance, 0.9)
        elif supported_technology_terms:
            relevance = max(relevance, 0.75)
        elif answer_context_overlap >= 0.6:
            relevance = max(relevance, 0.7)

    return relevance


def _expanded_terms(words: set[str]) -> set[str]:
    expanded = set(words)
    for word in words:
        if word.endswith("ies") and len(word) > 4:
            expanded.add(f"{word[:-3]}y")
        if word.endswith("s") and len(word) > 3:
            expanded.add(word[:-1])
        if word.endswith("ing") and len(word) > 5:
            expanded.add(word[:-3])
        if word.endswith("ed") and len(word) > 4:
            expanded.add(word[:-2])
    return expanded


def _is_technology_question(question: str) -> bool:
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
        "what does",
        "what do",
    )
    use_markers = (" use", " uses", " using", " built", " run on")
    return any(marker in normalized for marker in technology_markers) and (
        any(marker in normalized for marker in use_markers)
        or "technolog" in normalized
        or "stack" in normalized
    )


def _technology_terms(text: str) -> set[str]:
    known_terms = {
        "alembic",
        "asyncpg",
        "celery",
        "docker",
        "fastapi",
        "jwt",
        "next",
        "nextjs",
        "ollama",
        "postgres",
        "postgresql",
        "pydantic",
        "python",
        "qdrant",
        "redis",
        "sqlalchemy",
    }
    normalized = text.replace("Next.js", "NextJS").replace("Docker Compose", "DockerCompose")
    capitalized_terms = {
        term.lower().replace(".", "").replace("-", "")
        for term in re.findall(r"\b[A-Z][A-Za-z0-9.+#-]{2,}\b", normalized)
    }
    lower_words = set(re.findall(r"[a-zA-Z0-9_]{3,}", text.lower()))
    return (capitalized_terms | lower_words) & known_terms


def _overlap_score(source_words: set[str], target_words: set[str]) -> float:
    if not source_words:
        return 0.0
    return len(source_words & target_words) / len(source_words)


def _estimate_context_precision(
    question_words: set[str],
    contexts: list[dict[str, Any] | str],
) -> float:
    if not contexts or not question_words:
        return 0.0

    useful_contexts = 0
    for context in contexts:
        content = str(context.get("content", "")) if isinstance(context, dict) else context
        if question_words & _keywords(content):
            useful_contexts += 1
    return useful_contexts / len(contexts)


def _says_information_not_found(answer: str) -> bool:
    normalized = " ".join(answer.lower().split())
    not_found_phrases = (
        "could not find this information",
        "couldn't find this information",
        "information not found",
        "not in the context",
        "not in the uploaded documents",
        "no retrieved context",
    )
    return any(phrase in normalized for phrase in not_found_phrases)


def _coerce_score(value: object) -> float:
    if isinstance(value, bool):
        raise LLMProviderError("Evaluation score must be numeric")
    try:
        numeric_value = float(value)
    except (TypeError, ValueError) as exc:
        raise LLMProviderError("Evaluation score must be numeric") from exc
    return _round_score(numeric_value)


def _round_score(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 3)
