import type { RagHealthStatus } from "@/types";

export type InsightTone = "success" | "warning" | "critical" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  href?: string;
};

export type DerivedInsights = {
  findings: Insight[];
  risks: Insight[];
  recommendations: Insight[];
};

export type OverviewMetrics = {
  workspaceCount: number;
  statusCounts: Record<RagHealthStatus, number>;
  ragHealthScore: number; // 0–100
  faithfulness: number | null; // 0–1
  relevance: number | null;
  contextPrecision: number | null;
  hallucination: number | null; // 0–1
  retrievalSuccessRate: number | null; // 0–1
  indexedDocuments: number;
  totalDocuments: number;
  queuedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  deletedDocuments: number;
  totalChunks: number;
  chunksWithVectors: number;
  chunksMissing: number;
  embeddingCoverage: number; // 0–1
  totalQueries: number;
  avgLatencyMs: number | null;
  worstWorkspace: { id: string; name: string; score: number } | null;
};
