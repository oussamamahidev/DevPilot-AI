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
  role: "user" | "admin" | "super_admin";
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
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
  role: "user" | "admin" | "super_admin";
  is_active: boolean;
  deleted_at: string | null;
  deactivated_at: string | null;
  last_login_at: string | null;
  created_at: string;
  workspace_count: number;
  document_count: number;
};

export type AdminUserDetail = AdminUserSummary & {
  owned_workspace_count: number;
  conversation_count: number;
  recent_audit_events: AdminAuditLogSummary[];
};

export type AdminWorkspaceSummary = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  document_count: number;
  conversation_count?: number | null;
};

export type AdminWorkspaceDetail = AdminWorkspaceSummary & {
  owner: {
    id: string;
    email: string;
    full_name: string;
  };
  members: {
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    joined_at: string;
  }[];
  documents: {
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    status: string;
    created_at: string;
    processed_at: string | null;
    chunks_count: number;
    chunks_with_vector_id: number;
  }[];
  conversations_count: number;
  latest_activity: string | null;
  total_chunks: number;
  documents_by_status: Record<string, number>;
};

export type AdminDocumentSummary = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  uploaded_by: string | null;
  uploader_email: string | null;
  created_at: string;
  processed_at: string | null;
  chunks_count: number;
  chunks_with_vector_id: number;
};

export type AdminDocumentDetail = AdminDocumentSummary & {
  metadata: Record<string, unknown>;
  workspace: AdminWorkspaceSummary;
  uploader: {
    id: string;
    email: string;
    full_name: string;
  } | null;
  vector_coverage_percent: number;
};

export type AdminStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
    deleted: number;
    admins: number;
    super_admins: number;
  };
  workspaces: {
    total: number;
  };
  documents: {
    total: number;
    indexed: number;
    queued: number;
    processing: number;
    failed: number;
    deleted: number;
  };
  rag: {
    conversations: number;
    messages: number;
    evaluations: number;
    retrieved_chunks: number;
  };
  agents: {
    runs: number;
    avg_latency_ms_by_agent: Record<string, number>;
  };
  total_users: number;
  active_users: number;
  inactive_users: number;
  deleted_users: number;
  users_by_role: Record<string, number>;
  total_workspaces: number;
  total_documents: number;
  documents_by_status: Record<string, number>;
  total_chunks: number;
  total_conversations: number;
  total_rag_queries: number;
  average_latency_ms: number;
  average_faithfulness: number;
  average_relevance: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
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

export type AdminAuditLogSummary = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type RagHealthStatus = "healthy" | "warning" | "critical";
export type RagPipelineStepStatus = "completed" | "pending" | "failed";

export type RagOpsWorkspaceSummary = {
  workspace_id: string;
  workspace_name: string;
  owner_email: string;
  documents_total: number;
  documents_queued: number;
  documents_processing: number;
  documents_indexed: number;
  documents_failed: number;
  documents_deleted: number;
  total_chunks: number;
  chunks_with_vector_id: number;
  chunks_missing_vector_id: number;
  embedding_coverage_percent: number;
  average_chunk_length: number;
  last_document_uploaded_at: string | null;
  last_document_indexed_at: string | null;
  average_faithfulness: number;
  average_hallucination_score: number;
  rag_health_score: number;
  rag_health_status: RagHealthStatus;
};

export type RagOpsWorkspacesResponse = {
  items: RagOpsWorkspaceSummary[];
};

export type RagOpsWorkspaceDetail = {
  workspace: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  };
  owner: {
    id: string;
    email: string;
    full_name: string;
  };
  summary: RagOpsWorkspaceSummary;
  document_status_distribution: Record<string, number>;
  chunking_summary: {
    total_chunks: number;
    documents_with_chunks: number;
    documents_without_chunks: number;
    average_chunk_length: number;
    min_chunk_length: number;
    max_chunk_length: number;
  };
  embedding_summary: {
    total_chunks: number;
    chunks_with_vector_id: number;
    chunks_missing_vector_id: number;
    embedding_coverage_percent: number;
  };
  qdrant_summary: {
    qdrant_reachable: boolean;
    collection_name: string;
    collection_exists: boolean;
    vector_count: number | null;
    indexed_vectors_count: number | null;
    expected_chunks_count: number;
    postgres_vector_id_count: number;
    workspace_vector_count: number | null;
    mismatch_count: number | null;
    error: string | null;
  };
  recent_ingestion_jobs: RagOpsIngestionJob[];
  recent_failed_documents: RagOpsFailedDocument[];
  recent_rag_queries: RagOpsRecentQuery[];
  average_evaluation_scores: {
    faithfulness: number;
    relevance: number;
    context_precision: number;
    context_recall: number;
    hallucination_score: number;
  };
  average_agent_latency_by_agent_type: RagOpsAgentLatency[];
  rag_health_score: number;
  rag_health_status: RagHealthStatus;
};

export type RagOpsIngestionJob = {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  processing_duration_seconds: number | null;
  chunks_count: number;
  chunks_with_vector_id: number;
  chunks_missing_vector_id: number;
  embedding_coverage_percent: number;
};

export type RagOpsFailedDocument = {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  error: string | null;
};

export type RagOpsRecentQuery = {
  message_id: string;
  conversation_id: string;
  query_preview: string;
  retrieved_chunks_count: number;
  average_retrieval_score: number;
  latency_ms: number | null;
  faithfulness: number;
  relevance: number;
  created_at: string;
};

export type RagOpsAgentLatency = {
  agent_type: string;
  average_latency_ms: number;
  run_count: number;
  last_run_at: string | null;
};

export type RagOpsPipelineStage = {
  name: string;
  status: RagPipelineStepStatus;
  timestamp: string | null;
  detail: string | null;
};

export type RagOpsDocumentPipeline = {
  document: {
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    status: string;
    created_at: string;
    processed_at: string | null;
  };
  pipeline: Record<"upload" | "extraction" | "chunking" | "embedding" | "qdrant_indexing", RagPipelineStepStatus>;
  stats: {
    chunks_count: number;
    chunks_with_vector_id: number;
    chunks_missing_vector_id: number;
    embedding_coverage_percent: number;
    average_chunk_length: number;
    min_chunk_length: number;
    max_chunk_length: number;
  };
  qdrant: {
    collection: string;
    expected_vectors: number;
    indexed_vectors_known: boolean;
    qdrant_reachable: boolean;
    collection_exists: boolean;
    qdrant_vectors_count: number | null;
  };
  errors: string[];
  retry_allowed: boolean;
};

export type RagOpsChunkInspectItem = {
  chunk_id: string;
  chunk_index: number;
  content_preview: string;
  full_content: string | null;
  token_count: number | null;
  vector_id_exists: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RagOpsChunksResponse = {
  document_id: string;
  items: RagOpsChunkInspectItem[];
  total: number;
  page: number;
  page_size: number;
  include_content: boolean;
};

export type RagOpsRetryResponse = {
  document_id: string;
  status: string;
  task_enqueued: boolean;
  task_id: string | null;
  audit_action: string;
};

export type RagOpsQdrantHealth = {
  reachable: boolean;
  collections: {
    name: string;
    vector_count: number | null;
    indexed_vectors_count: number | null;
    status: string | null;
  }[];
  devpilot_collection_exists: boolean;
  postgres_chunks_with_vector_id: number;
  qdrant_vectors_count: number | null;
  mismatch_count: number | null;
  collection_name: string;
  indexed_vectors_count: number | null;
  postgres_chunks_total: number;
  chunks_missing_vector_id: number;
  error: string | null;
};

export type RagTraceListItem = {
  message_id: string;
  conversation_id: string;
  workspace_id: string;
  workspace_name: string;
  user_id: string | null;
  user_email: string | null;
  question_preview: string;
  answer_preview: string;
  retrieval_strategy: string | null;
  citation_count: number;
  faithfulness: number;
  relevance: number;
  context_precision: number;
  hallucination_score: number;
  corrected: boolean;
  created_at: string;
  total_latency_ms: number;
};

export type RagTraceListResponse = {
  items: RagTraceListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type RagTraceCitation = {
  rank: number;
  filename: string;
  chunk_index: number;
  score: number;
  content_preview: string;
  content: string | null;
  document_id: string;
  chunk_id: string;
};

export type RagTraceRetrievedChunk = {
  rank: number;
  filename: string;
  chunk_index: number;
  score: number;
  content_preview: string;
  content: string | null;
  source_scores: Record<string, number>;
  document_id: string | null;
  chunk_id: string | null;
};

export type RagTraceRerankingItem = {
  original_rank: number | null;
  final_rank: number | null;
  original_score: number;
  rerank_score: number | null;
  exact_matches: number | null;
  overlap: number | null;
  filename: string;
  content_preview: string;
  content: string | null;
  used_in_final_citations: boolean;
  document_id: string | null;
  chunk_id: string | null;
};

export type RagTraceEvaluation = {
  faithfulness: number;
  relevance: number;
  context_precision: number;
  hallucination_score: number;
  explanation: string;
  evaluation_method: "llm" | "heuristic" | "fallback" | "unknown";
  corrected: boolean;
  correction_reason: string | null;
};

export type RagTraceAgentRun = {
  id: string;
  agent_type: string;
  status: string;
  latency_ms: number | null;
  input_preview: Record<string, unknown>;
  output_preview: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
};

export type RagTraceCorrectorDecision = {
  corrected: boolean;
  correction_applied: boolean;
  reason: string | null;
  generated_answer_preview: string | null;
  final_answer_preview: string | null;
};

export type RagTraceDetail = {
  message_id: string;
  conversation_id: string;
  workspace: {
    id: string;
    name: string;
  };
  user: {
    id: string | null;
    email: string | null;
    full_name: string | null;
  };
  question: string;
  answer: string;
  retrieval_strategy: string | null;
  citations: RagTraceCitation[];
  retrieved_chunks: RagTraceRetrievedChunk[];
  evaluation: RagTraceEvaluation;
  agent_runs: RagTraceAgentRun[];
  latency_summary: {
    total_latency_ms: number;
    by_agent_type: Record<string, number>;
  };
  corrector_decision: RagTraceCorrectorDecision;
  raw_debug: Record<string, unknown>;
};

export type RagTraceRetrievalDetails = {
  message_id: string;
  original_query: string;
  rewritten_query: string | null;
  retrieval_strategy: string | null;
  chunks: RagTraceRetrievedChunk[];
};

export type RagTraceRerankingDetails = {
  message_id: string;
  reranker_details_available: boolean;
  items: RagTraceRerankingItem[];
};

export type RagTraceEvaluationDetails = RagTraceEvaluation & {
  message_id: string;
};

export type RagTraceQualitySummary = {
  total_rag_queries: number;
  average_faithfulness: number;
  average_relevance: number;
  average_context_precision: number;
  average_hallucination_score: number;
  low_quality_count: number;
  hallucination_risk_count: number;
  no_context_count: number;
  corrected_answers_count: number;
  average_latency_by_agent: Record<string, number>;
  worst_messages_by_hallucination: RagTraceWorstMessage[];
  worst_messages_by_relevance: RagTraceWorstMessage[];
};

export type RagTraceWorstMessage = {
  message_id: string;
  conversation_id: string;
  workspace_id: string;
  workspace_name: string;
  user_email: string | null;
  question_preview: string;
  answer_preview: string;
  faithfulness: number;
  relevance: number;
  context_precision: number;
  hallucination_score: number;
  created_at: string;
};
