from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel


EvaluationMethod = Literal["llm", "heuristic", "fallback"]


class RagTraceListItem(BaseModel):
    message_id: UUID
    conversation_id: UUID
    workspace_id: UUID
    workspace_name: str
    user_email: str | None
    question_preview: str
    answer_preview: str
    retrieval_strategy: str | None
    citation_count: int
    faithfulness: float
    relevance: float
    context_precision: float
    hallucination_score: float
    corrected: bool
    created_at: datetime
    total_latency_ms: int


class RagTraceListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    traces: list[RagTraceListItem]


class RagTraceWorkspaceInfo(BaseModel):
    id: UUID
    name: str


class RagTraceUserInfo(BaseModel):
    id: UUID | None
    email: str | None
    full_name: str | None


class RagTraceCitation(BaseModel):
    rank: int
    filename: str
    chunk_index: int
    score: float
    content_preview: str
    content: str | None = None
    document_id: UUID
    chunk_id: UUID


class RagTraceRetrievedChunk(BaseModel):
    rank: int
    filename: str
    chunk_index: int
    score: float
    content_preview: str
    content: str | None = None
    source_scores: dict[str, float]
    document_id: UUID | None
    chunk_id: UUID | None


class RagTraceRerankingItem(BaseModel):
    original_rank: int | None
    final_rank: int | None
    original_score: float
    rerank_score: float | None
    exact_matches: int | None
    overlap: float | None
    filename: str
    chunk_preview: str
    content: str | None = None
    used_in_final_citations: bool
    document_id: UUID | None = None
    chunk_id: UUID | None = None


class RagTraceEvaluation(BaseModel):
    faithfulness: float
    relevance: float
    context_precision: float
    context_recall: float | None
    hallucination_score: float
    explanation: str
    evaluation_method: EvaluationMethod
    corrector_changed_answer: bool
    correction_reason: str | None


class RagTraceAgentRun(BaseModel):
    id: UUID
    agent_type: str
    status: str
    latency_ms: int | None
    input_preview: dict[str, Any]
    output_preview: dict[str, Any] | None
    error: str | None
    created_at: datetime


class RagTraceLatencySummary(BaseModel):
    total_latency_ms: int
    by_agent_type: dict[str, int]


class RagTraceCorrectorDecision(BaseModel):
    corrected: bool
    correction_applied: bool
    reason: str | None
    generated_answer_preview: str | None
    final_answer_preview: str | None


class RagTraceDetail(BaseModel):
    message_id: UUID
    conversation_id: UUID
    user_question: str
    assistant_answer: str
    workspace: RagTraceWorkspaceInfo
    user: RagTraceUserInfo
    retrieval_strategy: str | None
    citations: list[RagTraceCitation]
    retrieved_chunks: list[RagTraceRetrievedChunk]
    evaluation: RagTraceEvaluation
    agent_runs: list[RagTraceAgentRun]
    latency_summary: RagTraceLatencySummary
    corrector_decision: RagTraceCorrectorDecision
    raw_debug: dict[str, Any]


class RagTraceRetrievalDetails(BaseModel):
    message_id: UUID
    original_query: str
    rewritten_query: str | None
    retrieval_strategy: str | None
    retrieved_chunks: list[RagTraceRetrievedChunk]


class RagTraceRerankingDetails(BaseModel):
    message_id: UUID
    items: list[RagTraceRerankingItem]


class RagTraceEvaluationDetails(RagTraceEvaluation):
    message_id: UUID


class RagTraceAgentLatencySummary(BaseModel):
    agent_type: str
    average_latency_ms: float
    run_count: int


class RagTraceWorstMessage(BaseModel):
    message_id: UUID
    conversation_id: UUID
    workspace_id: UUID
    workspace_name: str
    user_email: str | None
    question_preview: str
    answer_preview: str
    faithfulness: float
    relevance: float
    context_precision: float
    hallucination_score: float
    created_at: datetime


class RagTraceQualitySummary(BaseModel):
    total_rag_queries: int
    average_faithfulness: float
    average_relevance: float
    average_context_precision: float
    average_hallucination_score: float
    low_quality_count: int
    hallucination_risk_count: int
    no_context_count: int
    corrected_answers_count: int
    average_latency_by_agent_type: list[RagTraceAgentLatencySummary]
    worst_by_hallucination_score: list[RagTraceWorstMessage]
    worst_by_relevance: list[RagTraceWorstMessage]
