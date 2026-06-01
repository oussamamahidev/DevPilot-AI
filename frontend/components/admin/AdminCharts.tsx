"use client";

import type { StatusTone } from "@/components/ui/StatusBadge";

/* ─── tone → class maps (theme-aware, token-driven) ──────────── */
export const barBg: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
  info: "bg-info",
  ai: "bg-brand",
  neutral: "bg-line-strong",
};
export const barText: Record<StatusTone, string> = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  critical: "text-danger-fg",
  info: "text-info-fg",
  ai: "text-brand-fg",
  neutral: "text-fg-muted",
};

/* ─── score → tone helpers ───────────────────────────────────── */
export function pctTone(value: number, invert = false): StatusTone {
  if (invert) return value <= 0.3 ? "success" : value <= 0.6 ? "warning" : "critical";
  return value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "critical";
}
export function healthTone(score: number): StatusTone {
  return score >= 80 ? "success" : score >= 55 ? "warning" : "critical";
}
export function latencyTone(ms: number): StatusTone {
  return ms <= 1500 ? "success" : ms <= 4000 ? "warning" : "critical";
}
export function fmtMs(ms: number): string {
  if (ms <= 0) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

const BANDS: [number, number, string][] = [
  [0, 0.2, "0–20"],
  [0.2, 0.4, "20–40"],
  [0.4, 0.6, "40–60"],
  [0.6, 0.8, "60–80"],
  [0.8, 1.01, "80–100"],
];

export type Bucket = { label: string; count: number; tone: StatusTone };

export function scoreBuckets(values: number[], invert = false): Bucket[] {
  return BANDS.map(([lo, hi, label]) => ({
    label,
    count: values.filter((v) => v >= lo && v < hi).length,
    tone: pctTone(lo + 0.1, invert),
  }));
}

/* ─── ScoreMeter: labelled 0..1 progress ─────────────────────── */
export function ScoreMeter({
  label,
  value,
  invert = false,
  hint,
}: {
  label: string;
  value: number;
  invert?: boolean;
  hint?: string;
}) {
  const tone = pctTone(value, invert);
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-fg-muted">{label}</span>
        <span className={`shrink-0 font-semibold tabular-nums ${barText[tone]}`}>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full rounded-full ${barBg[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

/* ─── HBarChart: horizontal labelled bars (e.g. agent latency) ─ */
export function HBarChart({ rows }: { rows: { label: string; value: number; display: string; tone: StatusTone }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="truncate text-xs capitalize text-fg-muted" title={r.label}>
            {r.label}
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div
              className={`h-full rounded-full ${barBg[r.tone]}`}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-right text-xs font-medium tabular-nums text-fg">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Histogram: vertical 5-band column chart ────────────────── */
export function Histogram({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex h-28 items-end justify-between gap-2">
      {buckets.map((b, i) => (
        <div key={`${b.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className={`text-[11px] font-medium tabular-nums ${b.count > 0 ? barText[b.tone] : "text-fg-subtle"}`}>
            {b.count}
          </span>
          <div className="flex h-full w-full items-end">
            <div className={`w-full rounded-t ${barBg[b.tone]}`} style={{ height: `${(b.count / max) * 100}%` }} />
          </div>
          <span className="text-center text-[10px] leading-tight text-fg-subtle">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── StackedBar: a single proportional bar + legend ─────────── */
export function StackedBar({ segments }: { segments: { label: string; value: number; tone: StatusTone }[] }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div className="grid gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-sunken">
        {visible.map((s) => (
          <div key={s.label} className={barBg[s.tone]} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {segments.map((s) => (
          <li key={s.label} className="flex min-w-0 items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${barBg[s.tone]}`} />
              <span className="truncate capitalize text-fg-muted">{s.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-fg">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── HealthRing: SVG gauge (0..100) ─────────────────────────── */
export function HealthRing({ score, caption }: { score: number; caption?: string }) {
  const tone = healthTone(score);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative grid h-32 w-32 place-items-center ${barText[tone]}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="opacity-15" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <div className="absolute grid place-items-center text-center">
          <span className="text-3xl font-semibold tabular-nums text-fg">{Math.round(score)}</span>
          <span className="text-[10px] uppercase tracking-wide text-fg-subtle">/ 100</span>
        </div>
      </div>
      {caption ? <p className="text-center text-xs text-fg-subtle">{caption}</p> : null}
    </div>
  );
}

/* ─── agent latency rows from a Record<agent, ms> ────────────── */
const AGENT_ORDER = ["router", "query_rewriter", "retrieval", "reranker", "generator", "evaluator", "corrector"];
const AGENT_LABELS: Record<string, string> = {
  router: "Router",
  query_rewriter: "Rewriter",
  retrieval: "Retriever",
  reranker: "Reranker",
  generator: "Generator",
  evaluator: "Evaluator",
  corrector: "Corrector",
};

export function agentLatencyRows(record: Record<string, number>) {
  const keys = AGENT_ORDER.filter((k) => k in record).concat(Object.keys(record).filter((k) => !AGENT_ORDER.includes(k)));
  return keys.map((k) => {
    const value = record[k] ?? 0;
    return { label: AGENT_LABELS[k] ?? k.replace(/_/g, " "), value, display: fmtMs(value), tone: latencyTone(value) };
  });
}
