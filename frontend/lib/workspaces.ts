import { apiGet, apiPost } from "@/lib/api";
import type { Workspace, WorkspaceCreateInput } from "@/types";

export function listWorkspaces() {
  return apiGet<Workspace[]>("/api/v1/workspaces");
}

export function createWorkspace(input: WorkspaceCreateInput) {
  return apiPost<Workspace>("/api/v1/workspaces", input);
}

export function getWorkspace(workspaceId: string) {
  return apiGet<Workspace>(`/api/v1/workspaces/${workspaceId}`);
}
