import type { IconName } from "@/components/ui/Icon";

export type StageId =
  | "question"
  | "embedding"
  | "search"
  | "retrieval"
  | "rerank"
  | "context"
  | "prompt"
  | "generation"
  | "evaluation"
  | "persistence";

export type StageStatus = "pending" | "active" | "done" | "error";

export type StageDef = {
  id: StageId;
  label: string;
  caption: string;
  icon: IconName;
  accent: string;
};

/** A retrieved chunk projected for visualisation (all fields are real). */
export type ChunkVM = {
  rank: number;
  filename: string;
  score: number;
  preview: string;
  sourceScores: Record<string, number>;
  chunkId: string | null;
};

/** A reranking decision (real original→final ranks and scores). */
export type RerankVM = {
  filename: string;
  originalRank: number | null;
  finalRank: number | null;
  originalScore: number;
  rerankScore: number | null;
  used: boolean;
};

export type EvaluationVM = {
  faithfulness: number;
  relevance: number;
  contextPrecision: number;
  hallucination: number;
  explanation: string;
};

export type AgentRunVM = {
  agentType: string;
  latencyMs: number | null;
  status: string;
};

export type RunStatus = "idle" | "running" | "complete" | "error";

/** The complete, real execution captured from the streaming + trace APIs. */
export type ExecutionState = {
  question: string;
  rewrittenQuery: string | null;
  workspaceName: string | null;
  stageStatus: Record<StageId, StageStatus>;
  activeStage: StageId | null;
  citations: { id: number; filename: string; score: number; preview: string }[];
  retrieved: ChunkVM[];
  reranking: RerankVM[];
  answer: string;
  isStreaming: boolean;
  evaluation: EvaluationVM | null;
  agentRuns: AgentRunVM[];
  messageId: string | null;
  latencyMs: number | null;
  error: string | null;
  runStatus: RunStatus;
};
