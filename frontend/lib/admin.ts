import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AdminAuditLogSummary,
  AdminDocumentDetail,
  AdminDocumentsStats,
  AdminDocumentSummary,
  AdminErrorsResponse,
  AdminRagStats,
  AdminStats,
  AdminUsageStats,
  AdminUserDetail,
  AdminUserSummary,
  AdminWorkspaceDetail,
  AdminWorkspaceSummary,
  PaginatedResponse,
  RagOpsChunksResponse,
  RagOpsDocumentPipeline,
  RagOpsQdrantHealth,
  RagOpsRetryResponse,
  RagOpsWorkspaceDetail,
  RagOpsWorkspacesResponse,
  RagTraceDetail,
  RagTraceEvaluationDetails,
  RagTraceListResponse,
  RagTraceQualitySummary,
  RagTraceRerankingDetails,
  RagTraceRetrievalDetails,
} from "@/types";

type ListParams = {
  search?: string;
  status?: string;
  role?: string;
  action?: string;
  actor_user_id?: string;
  target_type?: string;
  target_id?: string;
  include_content?: boolean;
  workspace_id?: string;
  user_id?: string;
  retrieval_strategy?: string;
  min_faithfulness?: number;
  max_hallucination_score?: number;
  has_citations?: boolean;
  corrected?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  page?: number;
  page_size?: number;
  is_active?: boolean;
};

function queryString(params: Record<string, string | number | boolean | null | undefined> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getAdminStats() {
  return apiGet<AdminStats>("/api/v1/admin/stats");
}

export function listAdminUsers(params?: ListParams) {
  return apiGet<PaginatedResponse<AdminUserSummary>>(
    `/api/v1/admin/users${queryString(params)}`,
  );
}

export function getAdminUser(userId: string) {
  return apiGet<AdminUserDetail>(`/api/v1/admin/users/${userId}`);
}

export function updateAdminUserRole(userId: string, role: string, reason: string) {
  return apiPatch<AdminUserDetail>(`/api/v1/admin/users/${userId}/role`, {
    reason,
    role,
  });
}

export function deactivateAdminUser(userId: string, reason: string) {
  return apiPatch<AdminUserDetail>(`/api/v1/admin/users/${userId}/deactivate`, {
    reason,
  });
}

export function reactivateAdminUser(userId: string, reason: string) {
  return apiPatch<AdminUserDetail>(`/api/v1/admin/users/${userId}/reactivate`, {
    reason,
  });
}

export function deleteAdminUser(userId: string, reason: string, force = false) {
  return apiDelete<AdminUserDetail>(`/api/v1/admin/users/${userId}`, {
    body: { force, reason },
  });
}

export function listAdminWorkspaces(params?: ListParams) {
  return apiGet<PaginatedResponse<AdminWorkspaceSummary>>(
    `/api/v1/admin/workspaces${queryString(params)}`,
  );
}

export function getAdminWorkspace(workspaceId: string) {
  return apiGet<AdminWorkspaceDetail>(`/api/v1/admin/workspaces/${workspaceId}`);
}

export function deleteAdminWorkspace(
  workspaceId: string,
  reason: string,
  deleteDocuments = true,
) {
  return apiDelete<{ id: string; deleted: boolean }>(
    `/api/v1/admin/workspaces/${workspaceId}`,
    { body: { delete_documents: deleteDocuments, reason } },
  );
}

export function listAdminDocuments(params?: ListParams) {
  return apiGet<PaginatedResponse<AdminDocumentSummary>>(
    `/api/v1/admin/documents${queryString(params)}`,
  );
}

export function getAdminDocument(documentId: string) {
  return apiGet<AdminDocumentDetail>(`/api/v1/admin/documents/${documentId}`);
}

export function deleteAdminDocument(documentId: string, reason: string) {
  return apiDelete<AdminDocumentDetail>(`/api/v1/admin/documents/${documentId}`, {
    body: { reason },
  });
}

export function listAdminAuditLogs(params?: ListParams) {
  return apiGet<PaginatedResponse<AdminAuditLogSummary>>(
    `/api/v1/admin/audit-logs${queryString(params)}`,
  );
}

export function getAdminDocumentsStats() {
  return apiGet<AdminDocumentsStats>("/api/v1/admin/documents/stats");
}

export function getAdminRagStats() {
  return apiGet<AdminRagStats>("/api/v1/admin/rag/stats");
}

export function getAdminUsageStats() {
  return apiGet<AdminUsageStats>("/api/v1/admin/usage/stats");
}

export function listAdminErrors() {
  return apiGet<AdminErrorsResponse>("/api/v1/admin/errors");
}

export async function listRagOpsWorkspaces() {
  const response = await apiGet<RagOpsWorkspacesResponse>("/api/v1/admin/ragops/workspaces");
  return response.items;
}

export function getRagOpsWorkspace(workspaceId: string) {
  return apiGet<RagOpsWorkspaceDetail>(`/api/v1/admin/ragops/workspaces/${workspaceId}`);
}

export function getRagOpsDocumentPipeline(documentId: string) {
  return apiGet<RagOpsDocumentPipeline>(
    `/api/v1/admin/ragops/documents/${documentId}/pipeline`,
  );
}

export function listRagOpsDocumentChunks(
  documentId: string,
  params: { include_content?: boolean; page?: number; page_size?: number } = {},
) {
  return apiGet<RagOpsChunksResponse>(
    `/api/v1/admin/ragops/documents/${documentId}/chunks${queryString(params)}`,
  );
}

export function retryRagOpsDocument(documentId: string, reason: string) {
  return apiPost<RagOpsRetryResponse>(
    `/api/v1/admin/ragops/documents/${documentId}/retry`,
    { reason },
  );
}

export function getRagOpsQdrantHealth() {
  return apiGet<RagOpsQdrantHealth>("/api/v1/admin/ragops/qdrant/health");
}

export function listRagTraces(params?: ListParams) {
  return apiGet<RagTraceListResponse>(`/api/v1/admin/rag-traces${queryString(params)}`);
}

export function getRagTrace(messageId: string, includeContent = false) {
  return apiGet<RagTraceDetail>(
    `/api/v1/admin/rag-traces/${messageId}${queryString({
      include_content: includeContent,
    })}`,
  );
}

export function getRagTraceRetrieval(messageId: string, includeContent = false) {
  return apiGet<RagTraceRetrievalDetails>(
    `/api/v1/admin/rag-traces/${messageId}/retrieval${queryString({
      include_content: includeContent,
    })}`,
  );
}

export function getRagTraceReranking(messageId: string, includeContent = false) {
  return apiGet<RagTraceRerankingDetails>(
    `/api/v1/admin/rag-traces/${messageId}/reranking${queryString({
      include_content: includeContent,
    })}`,
  );
}

export function getRagTraceEvaluation(messageId: string) {
  return apiGet<RagTraceEvaluationDetails>(
    `/api/v1/admin/rag-traces/${messageId}/evaluation`,
  );
}

export function getRagTraceQualitySummary() {
  return apiGet<RagTraceQualitySummary>("/api/v1/admin/rag-traces/quality/summary");
}
