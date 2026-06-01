import type { RagTraceListItem, RagTraceQualitySummary } from "@/types";
import type { IconName } from "@/components/ui/Icon";
import type { Tone as DataTone } from "@/components/admin/DataView";
import { type Tone, traceHealthScore, scoreTone } from "@/features/trace-inspector/helpers";

export {
  type Tone,
  traceHealthScore,
  scoreTone,
  healthTone,
  riskLevel,
  formatLatency,
  safePreview,
  fmtNumber,
  shortenId,
} from "@/features/trace-inspector/helpers";

/* ─── filter model ───────────────────────────────────────────── */
export type TriState = "" | "yes" | "no";

export type ObservatoryFilters = {
  search: string;
  workspaceId: string;
  userEmail: string; // client-side (list items expose email, server filters by id)
  retrievalStrategy: string;
  /** lower bound on faithfulness — sent to server (min_faithfulness) */
  minFaithfulness: number | null;
  /** upper bound on faithfulness — applied client-side */
  maxFaithfulness: number | null;
  /** lower bound on hallucination — applied client-side */
  minHallucination: number | null;
  /** upper bound on hallucination — sent to server (max_hallucination_score) */
  maxHallucination: number | null;
  corrected: TriState;
  hasCitations: TriState;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: ObservatoryFilters = {
  search: "",
  workspaceId: "",
  userEmail: "",
  retrievalStrategy: "",
  minFaithfulness: null,
  maxFaithfulness: null,
  minHallucination: null,
  maxHallucination: null,
  corrected: "",
  hasCitations: "",
  dateFrom: "",
  dateTo: "",
};

export function activeFilterCount(f: ObservatoryFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.workspaceId) n++;
  if (f.userEmail) n++;
  if (f.retrievalStrategy) n++;
  if (f.minFaithfulness != null) n++;
  if (f.maxFaithfulness != null) n++;
  if (f.minHallucination != null) n++;
  if (f.maxHallucination != null) n++;
  if (f.corrected) n++;
  if (f.hasCitations) n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  return n;
}

/** Filters the server sample further by the bounds the API can't express. */
export function applyClientFilters(items: RagTraceListItem[], f: ObservatoryFilters): RagTraceListItem[] {
  return items.filter((t) => {
    if (f.userEmail && (t.user_email ?? "") !== f.userEmail) return false;
    if (f.maxFaithfulness != null && t.faithfulness > f.maxFaithfulness) return false;
    if (f.minHallucination != null && t.hallucination_score < f.minHallucination) return false;
    return true;
  });
}

/* ─── trace health score per row ─────────────────────────────── */
export function traceScore(t: RagTraceListItem): number {
  return traceHealthScore({
    faithfulness: t.faithfulness,
    relevance: t.relevance,
    hallucination: t.hallucination_score,
    latencyMs: t.total_latency_ms,
  });
}

/** A trace is "ungrounded" (a grounding failure) when it produced no citations. */
export function isUngrounded(t: RagTraceListItem): boolean {
  return t.citation_count === 0;
}

/* ─── tone bridge (inspector Tone → DataView Tone) ───────────── */
export function toDataTone(t: Tone): DataTone {
  return t === "ai" ? "brand" : t;
}

/* ─── KPI strip ──────────────────────────────────────────────── */
export type Kpi = { label: string; value: string; tone: DataTone; icon: IconName; hint?: string };

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * KPI strip. When filters narrow the dataset we compute over the loaded
 * sample; otherwise we use the authoritative global quality summary.
 */
export function buildKpis(
  items: RagTraceListItem[],
  total: number,
  summary: RagTraceQualitySummary | undefined,
  hasFilters: boolean,
): Kpi[] {
  const useSummary = !hasFilters && summary !== undefined;

  const avgFaith = useSummary ? summary!.average_faithfulness : mean(items.map((t) => t.faithfulness));
  const avgRel = useSummary ? summary!.average_relevance : mean(items.map((t) => t.relevance));
  const avgHall = useSummary ? summary!.average_hallucination_score : mean(items.map((t) => t.hallucination_score));
  const corrected = useSummary ? summary!.corrected_answers_count : items.filter((t) => t.corrected).length;
  const failed = useSummary ? summary!.no_context_count : items.filter(isUngrounded).length;
  const totalValue = useSummary ? summary!.total_rag_queries : total;

  return [
    { label: "Total traces", value: new Intl.NumberFormat("en-US").format(totalValue), tone: "brand", icon: "layers" },
    { label: "Avg faithfulness", value: pct(avgFaith), tone: toDataTone(scoreTone(avgFaith)), icon: "shield" },
    { label: "Avg relevance", value: pct(avgRel), tone: toDataTone(scoreTone(avgRel)), icon: "checkCircle" },
    { label: "Avg hallucination", value: pct(avgHall), tone: toDataTone(scoreTone(avgHall, true)), icon: "alertCircle" },
    { label: "Corrected answers", value: new Intl.NumberFormat("en-US").format(corrected), tone: corrected > 0 ? "info" : "neutral", icon: "refreshCw" },
    { label: useSummary ? "No-context traces" : "Ungrounded traces", value: new Intl.NumberFormat("en-US").format(failed), tone: failed > 0 ? "danger" : "success", icon: "alertCircle", hint: useSummary ? "no retrieval context" : "no citations" },
  ];
}

/* ─── distributions ──────────────────────────────────────────── */
export type Bucket = { label: string; count: number; tone: Tone };

const SCORE_BANDS: [number, number, string][] = [
  [0, 0.2, "0–20%"],
  [0.2, 0.4, "20–40%"],
  [0.4, 0.6, "40–60%"],
  [0.6, 0.8, "60–80%"],
  [0.8, 1.01, "80–100%"],
];

function bandIndex(value: number): number {
  for (let i = 0; i < SCORE_BANDS.length; i++) {
    if (value >= SCORE_BANDS[i][0] && value < SCORE_BANDS[i][1]) return i;
  }
  return SCORE_BANDS.length - 1;
}

export function faithfulnessBuckets(items: RagTraceListItem[]): Bucket[] {
  const counts = new Array(SCORE_BANDS.length).fill(0);
  items.forEach((t) => counts[bandIndex(t.faithfulness)]++);
  return SCORE_BANDS.map(([lo, , label], i) => ({ label, count: counts[i], tone: scoreTone(lo + 0.1) }));
}

export function hallucinationBuckets(items: RagTraceListItem[]): Bucket[] {
  const counts = new Array(SCORE_BANDS.length).fill(0);
  items.forEach((t) => counts[bandIndex(t.hallucination_score)]++);
  return SCORE_BANDS.map(([lo, , label], i) => ({ label, count: counts[i], tone: scoreTone(lo + 0.1, true) }));
}

const LATENCY_BANDS: [number, number, string, Tone][] = [
  [0, 1000, "< 1s", "success"],
  [1000, 2000, "1–2s", "success"],
  [2000, 4000, "2–4s", "warning"],
  [4000, 8000, "4–8s", "warning"],
  [8000, Infinity, "> 8s", "danger"],
];

export function latencyBuckets(items: RagTraceListItem[]): Bucket[] {
  const counts = new Array(LATENCY_BANDS.length).fill(0);
  items.forEach((t) => {
    const ms = t.total_latency_ms;
    const idx = LATENCY_BANDS.findIndex(([lo, hi]) => ms >= lo && ms < hi);
    counts[idx === -1 ? LATENCY_BANDS.length - 1 : idx]++;
  });
  return LATENCY_BANDS.map(([, , label, tone], i) => ({ label, count: counts[i], tone }));
}

/* ─── workspace comparison ───────────────────────────────────── */
export type WorkspaceStat = {
  id: string;
  name: string;
  count: number;
  avgFaithfulness: number;
  avgHallucination: number;
  tone: Tone;
};

export function workspaceComparison(items: RagTraceListItem[]): WorkspaceStat[] {
  const groups = new Map<string, RagTraceListItem[]>();
  items.forEach((t) => {
    const arr = groups.get(t.workspace_id) ?? [];
    arr.push(t);
    groups.set(t.workspace_id, arr);
  });
  return Array.from(groups.entries())
    .map(([id, rows]) => {
      const avgFaithfulness = mean(rows.map((r) => r.faithfulness));
      return {
        id,
        name: rows[0].workspace_name,
        count: rows.length,
        avgFaithfulness,
        avgHallucination: mean(rows.map((r) => r.hallucination_score)),
        tone: scoreTone(avgFaithfulness),
      };
    })
    .sort((a, b) => a.avgFaithfulness - b.avgFaithfulness); // worst first → "poor retrieval"
}

/* ─── alerts (derived from the filtered sample, sorted) ──────── */
export type AlertKind = "hallucinated" | "corrected" | "slowest" | "faithfulness";

export function topByHallucination(items: RagTraceListItem[], n = 5): RagTraceListItem[] {
  return [...items].sort((a, b) => b.hallucination_score - a.hallucination_score).slice(0, n);
}
export function correctedTraces(items: RagTraceListItem[], n = 5): RagTraceListItem[] {
  return items.filter((t) => t.corrected).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n);
}
export function slowestTraces(items: RagTraceListItem[], n = 5): RagTraceListItem[] {
  return [...items].sort((a, b) => b.total_latency_ms - a.total_latency_ms).slice(0, n);
}
export function worstFaithfulness(items: RagTraceListItem[], n = 5): RagTraceListItem[] {
  return [...items].sort((a, b) => a.faithfulness - b.faithfulness).slice(0, n);
}

/** Distinct retrieval strategies present in the loaded sample (for the filter). */
export function distinctStrategies(items: RagTraceListItem[]): string[] {
  return Array.from(new Set(items.map((t) => t.retrieval_strategy).filter((s): s is string => !!s))).sort();
}
/** Distinct user emails present in the loaded sample (for the client-side user filter). */
export function distinctUsers(items: RagTraceListItem[]): string[] {
  return Array.from(new Set(items.map((t) => t.user_email).filter((e): e is string => !!e))).sort();
}
