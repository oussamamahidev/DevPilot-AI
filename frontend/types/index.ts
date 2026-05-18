export type HealthResponse = {
  status: string;
  service?: string;
  app?: string;
  environment?: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  members: WorkspaceMember[];
};

export type WorkspaceCreateInput = {
  name: string;
  description?: string | null;
};

export type DocumentStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "indexed"
  | "failed"
  | "deleted";

export type Document = {
  id: string;
  workspace_id: string;
  uploaded_by: string | null;
  filename: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  storage_path: string;
  created_at: string;
  processed_at: string | null;
};

export type DocumentStatusResponse = {
  id: string;
  status: DocumentStatus;
};

export type Citation = {
  id: number;
  document_id: string;
  filename: string;
  chunk_id: string;
  chunk_index: number;
  score: number;
  content?: string;
};

export type AnswerEvaluation = {
  faithfulness: number;
  relevance: number;
  context_precision: number;
  hallucination_score: number;
  explanation: string;
};

export type ChatQueryRequest = {
  question: string;
  conversation_id?: string | null;
};

export type ChatQueryResponse = {
  answer: string;
  citations: Citation[];
  conversation_id: string;
  message_id: string;
  evaluation: AnswerEvaluation;
};

export type ConversationSummary = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
  citations: Citation[];
};

export type ConversationDetail = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
  metadata: Record<string, unknown>;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  workspace_count: number;
  document_count: number;
  conversation_count: number;
};

export type AdminWorkspaceSummary = {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  conversation_count: number;
};

export type AdminDocumentSummary = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  filename: string;
  file_type: string;
  status: string;
  uploaded_by: string | null;
  uploader_email: string | null;
  created_at: string;
  processed_at: string | null;
};

export type AdminDocumentsStats = {
  total_documents: number;
  documents_by_status: Record<string, number>;
  total_chunks: number;
  recent_documents: AdminDocumentSummary[];
};

export type AdminRagStats = {
  total_conversations: number;
  total_rag_queries: number;
  average_latency_ms: number;
  average_faithfulness: number;
  average_relevance: number;
};

export type AdminUsageStats = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
};

export type AdminErrorSummary = {
  id: string;
  source: string;
  message: string;
  status: string;
  created_at: string;
  context: Record<string, unknown>;
};

export type AdminErrorsResponse = {
  errors: AdminErrorSummary[];
};
