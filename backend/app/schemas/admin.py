from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AdminUserSummary(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    workspace_count: int
    document_count: int
    conversation_count: int


class AdminWorkspaceSummary(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    owner_email: str
    created_at: datetime
    updated_at: datetime
    document_count: int
    conversation_count: int


class AdminDocumentSummary(BaseModel):
    id: UUID
    workspace_id: UUID
    workspace_name: str
    filename: str
    file_type: str
    status: str
    uploaded_by: UUID | None
    uploader_email: str | None
    created_at: datetime
    processed_at: datetime | None


class AdminDocumentsStats(BaseModel):
    total_documents: int
    documents_by_status: dict[str, int]
    total_chunks: int
    recent_documents: list[AdminDocumentSummary]


class AdminRagStats(BaseModel):
    total_conversations: int
    total_rag_queries: int
    average_latency_ms: float
    average_faithfulness: float
    average_relevance: float


class AdminUsageStats(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float


class AdminErrorSummary(BaseModel):
    id: UUID
    source: str
    message: str
    status: str
    created_at: datetime
    context: dict[str, object]


class AdminErrorsResponse(BaseModel):
    errors: list[AdminErrorSummary]
