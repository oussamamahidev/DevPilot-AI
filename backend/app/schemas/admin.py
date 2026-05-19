from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


AdminRole = Literal["user", "admin", "super_admin"]


class ReasonRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def require_non_blank_reason(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("A reason is required")
        return normalized


class UserRoleUpdateRequest(ReasonRequest):
    role: AdminRole


class UserDeleteRequest(ReasonRequest):
    force: bool = False


class WorkspaceDeleteRequest(ReasonRequest):
    delete_documents: bool = True


class AdminUsersStats(BaseModel):
    total: int
    active: int
    inactive: int
    deleted: int
    admins: int
    super_admins: int


class AdminWorkspacesStats(BaseModel):
    total: int


class AdminDocumentsStatsBlock(BaseModel):
    total: int
    indexed: int
    queued: int
    processing: int
    failed: int
    deleted: int


class AdminRagStatsBlock(BaseModel):
    conversations: int
    messages: int
    evaluations: int
    retrieved_chunks: int


class AdminAgentsStatsBlock(BaseModel):
    runs: int
    avg_latency_ms_by_agent: dict[str, float]


class AdminStatsResponse(BaseModel):
    users: AdminUsersStats
    workspaces: AdminWorkspacesStats
    documents: AdminDocumentsStatsBlock
    rag: AdminRagStatsBlock
    agents: AdminAgentsStatsBlock

    # Legacy aggregate fields are kept for the existing dashboard widgets while the
    # nested governance contract above remains the primary API shape.
    total_users: int
    active_users: int
    inactive_users: int
    deleted_users: int
    users_by_role: dict[str, int]
    total_workspaces: int
    total_documents: int
    documents_by_status: dict[str, int]
    total_chunks: int
    total_conversations: int
    total_rag_queries: int
    average_latency_ms: float
    average_faithfulness: float
    average_relevance: float
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float


class PaginationMeta(BaseModel):
    total: int
    page: int
    page_size: int


class AdminUserSummary(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: AdminRole
    is_active: bool
    deleted_at: datetime | None
    deactivated_at: datetime | None
    created_at: datetime
    last_login_at: datetime | None
    workspace_count: int
    document_count: int


class AdminAuditLogSummary(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    actor_email: str | None
    action: str
    target_type: str
    target_id: UUID | None
    reason: str | None
    metadata: dict[str, object] | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime


class AdminUserDetail(AdminUserSummary):
    owned_workspace_count: int
    conversation_count: int
    recent_audit_events: list[AdminAuditLogSummary]


class AdminUsersPage(BaseModel):
    items: list[AdminUserSummary]
    total: int
    page: int
    page_size: int


class AdminWorkspaceSummary(BaseModel):
    id: UUID
    name: str
    description: str | None
    owner_id: UUID
    owner_email: str
    member_count: int
    document_count: int
    conversation_count: int | None = None
    created_at: datetime
    updated_at: datetime


class AdminWorkspaceMember(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    joined_at: datetime


class AdminWorkspaceDocument(BaseModel):
    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime
    processed_at: datetime | None
    chunks_count: int = 0
    chunks_with_vector_id: int = 0


class AdminWorkspaceOwner(BaseModel):
    id: UUID
    email: str
    full_name: str


class AdminWorkspaceDetail(AdminWorkspaceSummary):
    owner: AdminWorkspaceOwner
    members: list[AdminWorkspaceMember]
    documents: list[AdminWorkspaceDocument]
    conversations_count: int
    latest_activity: datetime | None
    total_chunks: int
    documents_by_status: dict[str, int]


class AdminWorkspacesPage(BaseModel):
    items: list[AdminWorkspaceSummary]
    total: int
    page: int
    page_size: int


class AdminDocumentSummary(BaseModel):
    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    workspace_id: UUID
    workspace_name: str
    uploaded_by: UUID | None
    uploader_email: str | None
    created_at: datetime
    processed_at: datetime | None
    chunks_count: int = 0
    chunks_with_vector_id: int = 0


class AdminDocumentDetail(AdminDocumentSummary):
    metadata: dict[str, object]
    workspace: AdminWorkspaceSummary
    uploader: AdminWorkspaceOwner | None
    vector_coverage_percent: float


class AdminDocumentsPage(BaseModel):
    items: list[AdminDocumentSummary]
    total: int
    page: int
    page_size: int


class AdminAuditLogsPage(BaseModel):
    items: list[AdminAuditLogSummary]
    total: int
    page: int
    page_size: int


class AdminDeleteResponse(BaseModel):
    id: UUID
    deleted: bool
    documents_deleted: int = 0
    vectors_delete_attempted: bool = False
    vector_delete_error: str | None = None


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
