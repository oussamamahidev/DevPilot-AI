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
    rag_health_status: RagHealthStatus


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


class RagOpsPipelineStage(BaseModel):
    name: str
    status: PipelineStepStatus
    timestamp: datetime | None = None
    detail: str | None = None


class RagOpsDocumentPipeline(BaseModel):
    document_id: UUID
    workspace_id: UUID
    workspace_name: str
    filename: str
    uploader_email: str | None
    upload_state: RagOpsPipelineStage
    extraction_state: RagOpsPipelineStage
    chunking_state: RagOpsPipelineStage
    embedding_state: RagOpsPipelineStage
    vector_indexing_state: RagOpsPipelineStage
    indexed_state: RagOpsPipelineStage
    pipeline_steps: list[RagOpsPipelineStage]
    file_type: str
    file_size: int
    status: str
    storage_path: str
    created_at: datetime
    processed_at: datetime | None
    processing_duration_seconds: float | None
    chunks_count: int
    chunks_with_vector_id: int
    chunks_missing_vector_id: int
    embedding_coverage_percent: float
    average_chunk_length: float
    min_chunk_length: int
    max_chunk_length: int
    qdrant_indexed: bool
    retry_allowed: bool
    errors: list[str]


class RagOpsChunkInspectItem(BaseModel):
    chunk_id: UUID
    chunk_index: int
    content_preview: str
    content: str | None = None
    token_count: int | None
    vector_id_exists: bool
    metadata: dict[str, Any]
    created_at: datetime


class RagOpsChunksResponse(BaseModel):
    document_id: UUID
    total: int
    limit: int
    offset: int
    include_content: bool
    chunks: list[RagOpsChunkInspectItem]


class RagOpsRetryRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class RagOpsRetryResponse(BaseModel):
    document_id: UUID
    status: str
    task_enqueued: bool
    audit_action: str


class RagOpsQdrantCollectionHealth(BaseModel):
    name: str
    vector_count: int | None = None
    indexed_vectors_count: int | None = None
    status: str | None = None


class RagOpsQdrantHealth(BaseModel):
    qdrant_reachable: bool
    collections: list[RagOpsQdrantCollectionHealth]
    collection_name: str
    vector_count: int | None = None
    indexed_vectors_count: int | None = None
    expected_chunks_count: int
    postgres_vector_id_count: int
    chunks_missing_vector_id: int
    mismatch_count: int | None = None
    error: str | None = None
