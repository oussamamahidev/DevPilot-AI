import type { ExecutionState, StageDef, StageId, StageStatus } from "./types";

/** Cinematic dark-only palette (intentionally isolated to the studio). */
export const C = {
  bg: "#06070d",
  bg2: "#0a0c15",
  panel: "#0d0f1a",
  panelHi: "#11142100",
  border: "#1b1f30",
  borderHi: "#2a3048",
  grid: "#121524",
  text: "#e9ebf7",
  muted: "#9aa1bb",
  subtle: "#5b6178",
};

export const STAGES: StageDef[] = [
  { id: "question", label: "User Question", caption: "Input enters the system", icon: "message", accent: "#38bdf8" },
  { id: "embedding", label: "Query Embedding", caption: "768-d vector forms", icon: "cpu", accent: "#818cf8" },
  { id: "search", label: "Vector Search", caption: "Nearest neighbours in vector space", icon: "search", accent: "#a78bfa" },
  { id: "retrieval", label: "Chunk Retrieval", caption: "Top candidates by similarity", icon: "layers", accent: "#c084fc" },
  { id: "rerank", label: "Reranking", caption: "Reorder by relevance", icon: "activity", accent: "#e879f9" },
  { id: "context", label: "Context Window", caption: "Chunks merge into context", icon: "box", accent: "#f472b6" },
  { id: "prompt", label: "Prompt Builder", caption: "System + context + question", icon: "code", accent: "#fb7185" },
  { id: "generation", label: "LLM Generation", caption: "Tokens stream in real time", icon: "sparkles", accent: "#34d399" },
  { id: "evaluation", label: "Evaluation", caption: "Faithfulness, relevance, risk", icon: "shield", accent: "#fbbf24" },
  { id: "persistence", label: "Trace Persistence", caption: "Message → runs → chunks → eval", icon: "database", accent: "#2dd4bf" },
];

export const STAGE_IDS: StageId[] = STAGES.map((s) => s.id);
export const stageDef = (id: StageId): StageDef => STAGES.find((s) => s.id === id) ?? STAGES[0];
export const stageIndex = (id: StageId | null): number => (id ? STAGE_IDS.indexOf(id) : -1);

export const PLAYBACK_SPEEDS = [1, 2, 5] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const initialStageStatus = (): Record<StageId, StageStatus> =>
  STAGE_IDS.reduce((acc, id) => ({ ...acc, [id]: "pending" }), {} as Record<StageId, StageStatus>);

export const initialExecution = (): ExecutionState => ({
  question: "",
  rewrittenQuery: null,
  workspaceName: null,
  stageStatus: initialStageStatus(),
  activeStage: null,
  citations: [],
  retrieved: [],
  reranking: [],
  answer: "",
  isStreaming: false,
  evaluation: null,
  agentRuns: [],
  messageId: null,
  latencyMs: null,
  error: null,
  runStatus: "idle",
});

/** Deterministic 2-D projection of a chunk into "vector space" for the
 *  visualisation. Derived only from the chunk's real id/rank — never random,
 *  so the same chunk always lands in the same place. */
export function projectPoint(seed: string, score: number): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const angle = ((h >>> 0) % 360) * (Math.PI / 180);
  // higher similarity → closer to the query node at the centre
  const radius = 14 + (1 - Math.max(0, Math.min(1, score))) * 78;
  return { x: 50 + Math.cos(angle) * radius * 0.92, y: 50 + Math.sin(angle) * radius * 0.78 };
}
