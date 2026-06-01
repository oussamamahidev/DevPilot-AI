"use client";

import { useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { CitationCard } from "@/components/ai/CitationCard";
import type { AnswerEvaluation, Citation } from "@/types";

/* ─── shared scoring ─────────────────────────────────────────── */
function scoreTone(value: number, inverted = false): "success" | "warning" | "critical" {
  if (inverted) return value <= 0.3 ? "success" : value <= 0.6 ? "warning" : "critical";
  return value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "critical";
}

const pillColor = (tone: "success" | "warning" | "critical") =>
  tone === "success" ? "border-success-line bg-success-subtle text-success-surface-fg"
  : tone === "warning" ? "border-warning-line bg-warning-subtle text-warning-surface-fg"
  : "border-danger-line bg-danger-subtle text-danger-surface-fg";

/* ─── EvaluationPills ────────────────────────────────────────── */
export function EvaluationPills({ evaluation }: { evaluation: AnswerEvaluation }) {
  const metrics = [
    { label: "Faith", value: evaluation.faithfulness ?? 0 },
    { label: "Rel", value: evaluation.relevance ?? 0 },
    { label: "Hall ↓", value: evaluation.hallucination_score ?? 0, inverted: true },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Answer quality scores">
      {metrics.map(({ label, value, inverted }) => (
        <span key={label} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${pillColor(scoreTone(value, inverted))}`}>
          {label} {value.toFixed(2)}
        </span>
      ))}
      {evaluation.explanation ? (
        <details className="mt-1 w-full">
          <summary className="cursor-pointer text-xs text-fg-subtle hover:text-fg">Why this score?</summary>
          <p className="mt-1 rounded-md bg-sunken p-2.5 text-xs leading-5 text-fg-muted">{evaluation.explanation}</p>
        </details>
      ) : null}
    </div>
  );
}

/* ─── SourceList (citation cards with previews) ──────────────── */
export function SourceList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
        <Icon name="layers" size={12} />
        {citations.length} Source{citations.length !== 1 ? "s" : ""}
      </p>
      <div className="grid gap-2">
        {citations.map(c => <CitationCard key={`${c.id}-${c.chunk_id}`} citation={c} />)}
      </div>
    </div>
  );
}

/* ─── FollowUpSuggestions ────────────────────────────────────── */
function generateFollowUps(question: string): string[] {
  const q = question.toLowerCase();
  if (q.includes("summar") || q.includes("overview") || q.includes("key"))
    return ["What are the key risks mentioned?", "What decisions were made and why?", "Are there any dependencies or blockers?"];
  if (q.includes("how") || q.includes("why") || q.includes("what"))
    return ["Can you give me a concrete example?", "What are the trade-offs here?", "What could go wrong with this approach?"];
  return ["Can you elaborate on this?", "What does this mean for our system?", "Are there related concepts I should understand?"];
}

export function FollowUpSuggestions({ question, onSelect, disabled }: { question: string; onSelect: (q: string) => void; disabled: boolean }) {
  const suggestions = useMemo(() => generateFollowUps(question), [question]);
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">Suggested follow-ups</p>
      <div className="grid gap-2">
        {suggestions.map(s => (
          <button key={s} type="button" disabled={disabled} onClick={() => onSelect(s)}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs text-fg-muted transition hover:border-line-strong hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40">
            <Icon name="arrowRight" size={13} className="shrink-0 text-fg-subtle" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
