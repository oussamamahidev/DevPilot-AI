"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { RagTraceListItem } from "@/types";
import {
  traceScore,
  scoreTone,
  healthTone,
  formatLatency,
  safePreview,
  isUngrounded,
  type Tone,
} from "@/features/trace-observatory/helpers";
import { ToneBadge, toneChip } from "@/features/trace-inspector/components/primitives";

/* ─── relative time ──────────────────────────────────────────── */
function relTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "—";
    const diff = Math.max(0, Date.now() - then);
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "—";
  }
}

/* ─── metric chip ────────────────────────────────────────────── */
function Metric({ label, value, tone }: { label?: string; value: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${toneChip[tone]}`}
    >
      {value}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export function TraceCard({ trace }: { trace: RagTraceListItem }) {
  const score = traceScore(trace);
  const question = safePreview(trace.question_preview) || "—";
  const answer = safePreview(trace.answer_preview) || "—";
  const ungrounded = isUngrounded(trace);

  let absoluteTime = "";
  try {
    absoluteTime = new Date(trace.created_at).toLocaleString();
  } catch {
    absoluteTime = "";
  }

  return (
    <Link
      href={`/admin/rag-traces/${trace.message_id}`}
      className="group block rounded-xl border border-line bg-surface p-4 transition hover:bg-hover hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {/* top row: question/answer + health score */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg line-clamp-2">{question}</p>
          <p className="mt-1 text-xs text-fg-muted line-clamp-2">{answer}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[10px] text-fg-subtle">Health</span>
          <span
            className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${toneChip[healthTone(score)]}`}
          >
            {score}
            <span className="opacity-70">/100</span>
          </span>
        </div>
      </div>

      {/* meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
        <span className="inline-flex items-center gap-1 min-w-0">
          <Icon name="layers" size={13} className="shrink-0" />
          <span className="truncate max-w-[12rem]">{trace.workspace_name}</span>
        </span>
        <span className="inline-flex items-center gap-1 min-w-0">
          <Icon name="user" size={13} className="shrink-0" />
          <span className="truncate max-w-[12rem]">{trace.user_email ?? "—"}</span>
        </span>
        <span className="inline-flex items-center gap-1 min-w-0">
          <Icon name="zap" size={13} className="shrink-0" />
          <span className="truncate">{trace.retrieval_strategy ?? "—"}</span>
        </span>
        <span className="inline-flex items-center gap-1 min-w-0" title={absoluteTime || undefined}>
          <Icon name="clock" size={13} className="shrink-0" />
          <span className="truncate">{relTime(trace.created_at)}</span>
        </span>
      </div>

      {/* metrics row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Metric
          label="Faithfulness"
          value={`F ${Math.round(trace.faithfulness * 100)}%`}
          tone={scoreTone(trace.faithfulness)}
        />
        <Metric
          label="Relevance"
          value={`R ${Math.round(trace.relevance * 100)}%`}
          tone={scoreTone(trace.relevance)}
        />
        <Metric
          label="Hallucination"
          value={`H ${Math.round(trace.hallucination_score * 100)}%`}
          tone={scoreTone(trace.hallucination_score, true)}
        />
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${toneChip["neutral"]}`}
        >
          <Icon name="clock" size={11} />
          {formatLatency(trace.total_latency_ms)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${
            toneChip[trace.citation_count > 0 ? "info" : "danger"]
          }`}
        >
          <Icon name="link" size={11} />
          {trace.citation_count}
        </span>
        {trace.corrected ? <ToneBadge tone="info" label="Corrected" icon="refreshCw" /> : null}
        {ungrounded ? <ToneBadge tone="danger" label="No citations" icon="alertCircle" /> : null}
      </div>
    </Link>
  );
}
