import type { IconName } from "@/components/ui/Icon";
import type {
  RagTraceAgentRun,
  RagTraceDetail,
  RagTraceEvaluationDetails,
  RagTraceRerankingItem,
} from "@/types";

/* ─── agent metadata ─────────────────────────────────────────── */
export const AGENT_ORDER = ["router", "query_rewriter", "retrieval", "reranker", "generator", "evaluator", "corrector"];

export const AGENT_META: Record<string, { label: string; icon: IconName; description: string }> = {
  router: { label: "Router", icon: "selector", description: "Routes the query into the RAG pipeline" },
  query_rewriter: { label: "Query Rewriter", icon: "refreshCw", description: "Rewrites the question for better retrieval" },
  retrieval: { label: "Retriever", icon: "search", description: "Fetches candidate chunks from the vector store" },
  reranker: { label: "Reranker", icon: "activity", description: "Reorders candidates by relevance" },
  generator: { label: "Generator", icon: "sparkles", description: "Produces the grounded answer" },
  evaluator: { label: "Evaluator", icon: "shield", description: "Scores faithfulness, relevance, hallucination" },
  corrector: { label: "Corrector", icon: "checkCircle", description: "Repairs unfaithful or unsafe answers" },
};

export function agentLabel(agentType: string) {
  return AGENT_META[agentType]?.label ?? agentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function agentIcon(agentType: string): IconName {
  return AGENT_META[agentType]?.icon ?? "box";
}

/* ─── agent status (fixes phantom "completed") ───────────────── */
export type AgentStatus = "completed" | "failed" | "skipped" | "running";

export function getAgentRun(runs: RagTraceAgentRun[], agentType: string): RagTraceAgentRun | null {
  return runs.find((r) => r.agent_type === agentType) ?? null;
}

/** An agent that never ran is "skipped" — never silently green. */
export function agentStatus(run: RagTraceAgentRun | null): AgentStatus {
  if (!run) return "skipped";
  if (run.error) return "failed";
  const s = (run.status ?? "").toLowerCase();
  if (s.includes("fail") || s.includes("error")) return "failed";
  if (s.includes("run") || s.includes("progress") || s.includes("pending")) return "running";
  return "completed";
}

export function orderAgents(runs: RagTraceAgentRun[]): RagTraceAgentRun[] {
  const grouped = new Map<string, RagTraceAgentRun[]>();
  runs.forEach((run) => grouped.set(run.agent_type, [...(grouped.get(run.agent_type) ?? []), run]));
  const ordered = AGENT_ORDER.flatMap((t) => grouped.get(t) ?? []);
  const extras = runs.filter((r) => !AGENT_ORDER.includes(r.agent_type));
  return [...ordered, ...extras];
}

/* ─── metric resolution (detail overrides embedded) ──────────── */
export function metric(value: number | null | undefined, fallback: number): number {
  return value === null || value === undefined ? fallback : value;
}

export function resolveScores(trace: RagTraceDetail, evaluation: RagTraceEvaluationDetails | undefined) {
  return {
    faithfulness: metric(evaluation?.faithfulness, trace.evaluation.faithfulness),
    relevance: metric(evaluation?.relevance, trace.evaluation.relevance),
    contextPrecision: metric(evaluation?.context_precision, trace.evaluation.context_precision),
    hallucination: metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score),
  };
}

/* ─── trace health score 0–100 ───────────────────────────────── */
export function latencyScore(latencyMs: number): number {
  // 1.0 at ≤1s, 0.0 at ≥10s, linear between.
  return Math.max(0, Math.min(1, 1 - (latencyMs - 1000) / 9000));
}

export function traceHealthScore(s: { faithfulness: number; relevance: number; hallucination: number; latencyMs: number }): number {
  const score = s.faithfulness * 40 + s.relevance * 25 + (1 - s.hallucination) * 25 + latencyScore(s.latencyMs) * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type Tone = "success" | "warning" | "danger" | "info" | "ai" | "neutral";

export function scoreTone(value: number, invert = false): Tone {
  if (invert) return value <= 0.3 ? "success" : value <= 0.6 ? "warning" : "danger";
  return value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "danger";
}
export function healthTone(score: number): Tone {
  return score >= 80 ? "success" : score >= 55 ? "warning" : "danger";
}
export function riskLevel(hallucination: number): { label: string; tone: Tone } {
  if (hallucination <= 0.3) return { label: "Low risk", tone: "success" };
  if (hallucination <= 0.6) return { label: "Medium risk", tone: "warning" };
  return { label: "High risk", tone: "danger" };
}

/* ─── reranking promotion ────────────────────────────────────── */
export type RankChange = "promoted" | "demoted" | "same" | "new" | "dropped";
export function rankChange(item: RagTraceRerankingItem): RankChange {
  const { original_rank: o, final_rank: f } = item;
  if (o == null && f != null) return "new";
  if (o != null && f == null) return "dropped";
  if (o == null || f == null) return "same";
  if (f < o) return "promoted";
  if (f > o) return "demoted";
  return "same";
}

/* ─── citation marker parsing ────────────────────────────────── */
export type AnswerSegment = { type: "text"; text: string } | { type: "cite"; num: number };
export function splitAnswerByCitations(answer: string): AnswerSegment[] {
  const re = /\[(\d+)\]/g;
  const out: AnswerSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    if (m.index > last) out.push({ type: "text", text: answer.slice(last, m.index) });
    out.push({ type: "cite", num: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < answer.length) out.push({ type: "text", text: answer.slice(last) });
  return out;
}

/* ─── word-level diff (LCS) ──────────────────────────────────── */
export type DiffSeg = { type: "same" | "add" | "remove"; text: string };
function tokenize(s: string): string[] {
  return s.match(/\s+|\S+/g) ?? [];
}
export function diffWords(oldText: string, newText: string): DiffSeg[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segs: DiffSeg[] = [];
  const push = (type: DiffSeg["type"], text: string) => {
    const last = segs[segs.length - 1];
    if (last && last.type === type) last.text += text;
    else segs.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("remove", a[i]); i++; }
    else { push("add", b[j]); j++; }
  }
  while (i < m) { push("remove", a[i]); i++; }
  while (j < n) { push("add", b[j]); j++; }
  return segs;
}

/* ─── LLM usage extractor (real-only, no fabrication) ────────── */
export type UsageInfo = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
  costUsd?: number;
  found: boolean;
};

const USAGE_KEYS = {
  prompt: ["prompt_tokens", "input_tokens", "prompttokens"],
  completion: ["completion_tokens", "output_tokens", "completiontokens"],
  total: ["total_tokens", "totaltokens"],
  model: ["model", "model_name", "llm_model", "generation_model"],
  cost: ["cost", "cost_usd", "estimated_cost_usd", "estimated_cost"],
};

function deepFind(obj: unknown, keys: string[], depth = 0): unknown {
  if (!obj || typeof obj !== "object" || depth > 4) return undefined;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keys.includes(k.toLowerCase()) && (typeof v === "number" || typeof v === "string")) return v;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const found = deepFind(v, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function extractUsage(trace: RagTraceDetail): UsageInfo {
  const gen = getAgentRun(trace.agent_runs, "generator");
  const sources = [gen?.output_preview, gen?.input_preview, trace.raw_debug].filter(Boolean) as Record<string, unknown>[];
  const num = (keys: string[]): number | undefined => {
    for (const s of sources) {
      const v = deepFind(s, keys);
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    }
    return undefined;
  };
  const str = (keys: string[]): string | undefined => {
    for (const s of sources) {
      const v = deepFind(s, keys);
      if (typeof v === "string" && v.trim() !== "") return v;
    }
    return undefined;
  };
  const promptTokens = num(USAGE_KEYS.prompt);
  const completionTokens = num(USAGE_KEYS.completion);
  let totalTokens = num(USAGE_KEYS.total);
  if (totalTokens === undefined && promptTokens !== undefined && completionTokens !== undefined) {
    totalTokens = promptTokens + completionTokens;
  }
  const model = str(USAGE_KEYS.model);
  const costUsd = num(USAGE_KEYS.cost);
  const found = [promptTokens, completionTokens, totalTokens, model, costUsd].some((v) => v !== undefined);
  return { promptTokens, completionTokens, totalTokens, model, costUsd, found };
}

/** Pretty-print an agent's input/output preview record. */
export function previewText(record: Record<string, unknown> | null | undefined): string {
  if (!record) return "";
  try {
    return JSON.stringify(record, null, 2);
  } catch {
    return String(record);
  }
}

/* ─── formatting ─────────────────────────────────────────────── */
export function formatLatency(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
export function safePreview(text?: string | null, max = 180): string {
  if (!text) return "—";
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
export function shortenId(id?: string | null, size = 8): string {
  if (!id) return "—";
  return id.length <= size + 4 ? id : `${id.slice(0, size)}…${id.slice(-4)}`;
}
export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
export function sanitizeDebug(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj == null) return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeDebug(v, depth + 1));
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
        const n = k.toLowerCase();
        if (n.includes("password") || n.includes("secret") || n.includes("api_key") || n.includes("token")) {
          return [k, "‹hidden›"];
        }
        return [k, sanitizeDebug(v, depth + 1)];
      }),
    );
  }
  return obj;
}
