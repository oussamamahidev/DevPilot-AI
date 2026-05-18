import { apiGet } from "@/lib/api";
import type {
  AdminDocumentsStats,
  AdminErrorsResponse,
  AdminRagStats,
  AdminUsageStats,
  AdminUserSummary,
  AdminWorkspaceSummary,
} from "@/types";

export function listAdminUsers() {
  return apiGet<AdminUserSummary[]>("/api/v1/admin/users");
}

export function listAdminWorkspaces() {
  return apiGet<AdminWorkspaceSummary[]>("/api/v1/admin/workspaces");
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
