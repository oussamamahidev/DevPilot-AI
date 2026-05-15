import { apiDelete, apiFetch, apiGet } from "@/lib/api";
import type { Document, DocumentStatusResponse } from "@/types";

export function listDocuments(workspaceId: string) {
  return apiGet<Document[]>(`/api/v1/workspaces/${workspaceId}/documents`);
}

export function uploadDocument(workspaceId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<Document>(`/api/v1/workspaces/${workspaceId}/documents`, {
    body: formData,
    method: "POST",
  });
}

export function getDocumentStatus(documentId: string) {
  return apiGet<DocumentStatusResponse>(`/api/v1/documents/${documentId}/status`);
}

export function deleteDocument(documentId: string) {
  return apiDelete<Document>(`/api/v1/documents/${documentId}`);
}
