import { apiGet, apiPost } from "@/lib/api";
import type {
  ChatQueryRequest,
  ChatQueryResponse,
  ConversationDetail,
  ConversationSummary,
} from "@/types";

export function queryWorkspaceChat(workspaceId: string, input: ChatQueryRequest) {
  return apiPost<ChatQueryResponse>(
    `/api/v1/workspaces/${workspaceId}/chat/query`,
    input,
  );
}

export function listWorkspaceConversations(workspaceId: string) {
  return apiGet<ConversationSummary[]>(
    `/api/v1/workspaces/${workspaceId}/conversations`,
  );
}

export function getConversation(conversationId: string) {
  return apiGet<ConversationDetail>(`/api/v1/conversations/${conversationId}`);
}
