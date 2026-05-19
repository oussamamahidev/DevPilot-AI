from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


RagHealthStatus = Literal["healthy", "warning", "critical"]
PipelineStepStatus = Literal["completed", "pending", "failed"]


class RagOpsWorkspaceSummary(BaseModel):
    workspace_id: UUID
    workspace_name: str
    owner_email: str
    documents_total: int
    documents_queued: int
    documents_processing: int
    documents_indexed: int
    documents_failed: int
    documents_deleted: int
    total_chunks: int
    chunks_with_vector_id: int
    chunks_missing_vector_id: int
    embedding_coverage_percent: float
    average_chunk_length: float
    last_document_uploaded_at: datetime | None
    last_document_indexed_at: datetime | None
    average_faithfulness: float
    average_hallucination_score: float
    rag_health_score: int
    rag_health_status: RagHealthStatus


class RagOpsWorkspacesResponse(BaseModel):
    items: list[RagOpsWorkspaceSummary]


class RagOpsWorkspaceInfo(BaseModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class RagOpsOwnerInfo(BaseModel):
    id: UUID
    email: str
    full_name: str


class RagOpsChunkingSummary(BaseModel):
    total_chunks: int
    documents_with_chunks: int
    documents_without_chunks: int
    average_chunk_length: float
    min_chunk_length: int
    max_chunk_length: int


class RagOpsEmbeddingSummary(BaseModel):
    total_chunks: int
    chunks_with_vector_id: int
    chunks_missing_vector_id: int
    embedding_coverage_percent: float


class RagOpsQdrantSummary(BaseModel):
    qdrant_reachable: bool
    collection_name: str
    collection_exists: bool
    vector_count: int | None = None
    indexed_vectors_count: int | None = None
    expected_chunks_count: int
    postgres_vector_id_count: int
    workspace_vector_count: int | None = None
    mismatch_count: int | None = None
    error: str | None = None


class RagOpsIngestionJob(BaseModel):
    document_id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime
    processed_at: datetime | None
    processing_duration_seconds: float | None
    chunks_count: int
    chunks_with_vector_id: int
    chunks_missing_vector_id: int
    embedding_coverage_percent: float


class RagOpsFailedDocument(BaseModel):
    document_id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime
    processed_at: datetime | None
    error: str | None


class RagOpsRecentQuery(BaseModel):
    message_id: UUID
    conversation_id: UUID
    query_preview: str
    retrieved_chunks_count: int
    average_retrieval_score: float
    latency_ms: int | None
    faithfulness: float
    relevance: float
    created_at: datetime


class RagOpsEvaluationScores(BaseModel):
    faithfulness: float
    relevance: float
    context_precision: float
    context_recall: float
    hallucination_score: float


class RagOpsAgentLatency(BaseModel):
    agent_type: str
    average_latency_ms: float
    run_count: int
    last_run_at: datetime | None


class RagOpsWorkspaceDetail(BaseModel):
    workspace: RagOpsWorkspaceInfo
    owner: RagOpsOwnerInfo
    summary: RagOpsWorkspaceSummary
    document_status_distribution: dict[str, int]
    chunking_summary: RagOpsChunkingSummary
    embedding_summary: RagOpsEmbeddingSummary
    qdrant_summary: RagOpsQdrantSummary
    recent_ingestion_jobs: list[RagOpsIngestionJob]
    recent_failed_documents: list[RagOpsFailedDocument]
    recent_rag_queries: list[RagOpsRecentQuery]
    average_evaluation_scores: RagOpsEvaluationScores
    average_agent_latency_by_agent_type: list[RagOpsAgentLatency]
    rag_health_score: int
    rag_health_status: RagHealthStatus


class RagOpsPipelineStage(BaseModel):
    name: str
    status: PipelineStepStatus
    timestamp: datetime | None = None
    detail: str | None = None


class RagOpsPipelineDocument(BaseModel):
    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime
    processed_at: datetime | None


class RagOpsDocumentPipelineStats(BaseModel):
    chunks_count: int
    chunks_with_vector_id: int
    chunks_missing_vector_id: int
    embedding_coverage_percent: float
    average_chunk_length: float
    min_chunk_length: int
    max_chunk_length: int


class RagOpsDocumentQdrantPipeline(BaseModel):
    collection: str
    expected_vectors: int
    indexed_vectors_known: bool
    qdrant_reachable: bool
    collection_exists: bool
    qdrant_vectors_count: int | None = None


class RagOpsDocumentPipeline(BaseModel):
    document: RagOpsPipelineDocument
    pipeline: dict[str, PipelineStepStatus]
    stats: RagOpsDocumentPipelineStats
    qdrant: RagOpsDocumentQdrantPipeline
    errors: list[str]
    retry_allowed: bool


class RagOpsChunkInspectItem(BaseModel):
    chunk_id: UUID
    chunk_index: int
    content_preview: str
    full_content: str | None = None
    token_count: int | None
    vector_id_exists: bool
    metadata: dict[str, Any]
    created_at: datetime


class RagOpsChunksResponse(BaseModel):
    document_id: UUID
    items: list[RagOpsChunkInspectItem]
    total: int
    page: int
    page_size: int
    include_content: bool


class RagOpsRetryRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class RagOpsRetryResponse(BaseModel):
    document_id: UUID
    status: str
    task_enqueued: bool
    task_id: str | None = None
    audit_action: str


class RagOpsQdrantCollectionHealth(BaseModel):
    name: str
    vector_count: int | None = None
    indexed_vectors_count: int | None = None
    status: str | None = None


class RagOpsQdrantHealth(BaseModel):
    reachable: bool
    collections: list[RagOpsQdrantCollectionHealth]
    devpilot_collection_exists: bool
    postgres_chunks_with_vector_id: int
    qdrant_vectors_count: int | None = None
    mismatch_count: int | None = None
    collection_name: str
    indexed_vectors_count: int | None = None
    postgres_chunks_total: int
    chunks_missing_vector_id: int
    error: str | None = None
