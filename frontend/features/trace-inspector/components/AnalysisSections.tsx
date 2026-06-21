"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  Section,
  CopyButton,
  ScoreBar,
  ToneBadge,
  KeyVal,
  Panel,
} from "@/features/trace-inspector/components/primitives";
import {
  resolveScores,
  scoreTone,
  riskLevel,
  diffWords,
  extractUsage,
  getAgentRun,
  previewText,
  formatLatency,
  fmtNumber,
  sanitizeDebug,
} from "@/features/trace-inspector/helpers";
import type {
  RagTraceDetail,
  RagTraceEvaluationDetails,
} from "@/types";

/* ─────────────────────────────────────────────────────────────
 * 6) Evaluation Center
 * ──────────────────────────────────────────────────────────── */
const METRIC_DESCRIPTIONS: Record<string, string> = {
  faithfulness: "How well the answer is grounded in the retrieved context.",
  relevance: "How relevant the answer is to the user's question.",
  contextPrecision: "How precisely the retrieved context matches the need.",
  hallucination: "Estimated likelihood the answer contains unsupported claims.",
};

export function EvaluationCenter({
  trace,
  evaluation,
}: {
  trace: RagTraceDetail;
  evaluation: RagTraceEvaluationDetails | undefined;
}) {
  const s = resolveScores(trace, evaluation);
  const risk = riskLevel(s.hallucination);
  const method = evaluation?.evaluation_method ?? trace.evaluation.evaluation_method;
  const corrected = evaluation?.corrected ?? trace.evaluation.corrected;
  const explanation = (evaluation?.explanation ?? trace.evaluation.explanation)?.trim();

  const cards: { key: string; label: string; value: number; invert: boolean }[] = [
    { key: "faithfulness", label: "Faithfulness", value: s.faithfulness, invert: false },
    { key: "relevance", label: "Relevance", value: s.relevance, invert: false },
    { key: "contextPrecision", label: "Context Precision", value: s.contextPrecision, invert: false },
    { key: "hallucination", label: "Hallucination", value: s.hallucination, invert: true },
  ];

  return (
    <Section
      id="evaluation"
      num={6}
      icon="shield"
      title="Evaluation Center"
      subtitle="How the answer scored against the retrieved context"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge
            tone={method === "llm" ? "ai" : method === "heuristic" ? "info" : "neutral"}
            label={`Method: ${method}`}
            icon="activity"
          />
          <ToneBadge
            tone={corrected ? "ai" : "neutral"}
            label={corrected ? "Corrected" : "Not corrected"}
            icon={corrected ? "refreshCw" : "checkCircle"}
          />
        </div>
      }
    >
      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c) => {
          const tone = scoreTone(c.value, c.invert);
          const toneColor =
            tone === "success"
              ? "text-success-fg"
              : tone === "warning"
                ? "text-warning-fg"
                : tone === "danger"
                  ? "text-danger-fg"
                  : tone === "info"
                    ? "text-info-fg"
                    : tone === "ai"
                      ? "text-brand-fg"
                      : "text-fg-muted";
          return (
            <div
              key={c.key}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-sunken p-3"
            >
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                {c.label}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${toneColor}`}>
                {c.value.toFixed(2)}
              </p>
              <ScoreBar label={c.label} value={c.value} invert={c.invert} />
              <p className="text-[11px] leading-snug text-fg-subtle break-words">
                {METRIC_DESCRIPTIONS[c.key]}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-4 flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3 ${
          risk.tone === "success"
            ? "border-success-line bg-success-subtle"
            : risk.tone === "warning"
              ? "border-warning-line bg-warning-subtle"
              : "border-danger-line bg-danger-subtle"
        }`}
      >
        <div className="shrink-0">
          <ToneBadge
            tone={risk.tone}
            label={risk.label}
            icon={risk.tone === "success" ? "checkCircle" : "alertCircle"}
          />
        </div>
        <p className="min-w-0 text-xs leading-snug text-fg-muted break-words">
          Hallucination score is{" "}
          <span className="font-semibold tabular-nums text-fg">
            {s.hallucination.toFixed(2)}
          </span>
          , indicating <span className="font-medium">{risk.label.toLowerCase()}</span> of
          unsupported claims in the answer.
        </p>
      </div>

      <div className="mt-4">
        <Panel title="Evaluator explanation">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
            {explanation || "No explanation recorded"}
          </p>
        </Panel>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 7) Corrector Analysis
 * ──────────────────────────────────────────────────────────── */
export function CorrectorAnalysis({ trace }: { trace: RagTraceDetail }) {
  const cd = trace.corrector_decision;
  const original = cd.generated_answer_preview?.trim() ? cd.generated_answer_preview : null;
  const final = cd.final_answer_preview ?? trace.answer;

  const [view, setView] = useState<"diff" | "split">("diff");

  return (
    <Section
      id="corrector"
      num={7}
      icon="refreshCw"
      title="Corrector Analysis"
      subtitle="Whether the CorrectorAgent changed the answer"
      actions={
        <ToneBadge
          tone={cd.corrected ? "ai" : "neutral"}
          label={cd.corrected ? "Corrected" : "No correction"}
          icon={cd.corrected ? "refreshCw" : "checkCircle"}
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border border-line bg-sunken p-3 sm:grid-cols-3">
          <KeyVal
            label="Corrected"
            value={cd.corrected ? "Yes" : "No"}
            tone={cd.corrected ? "ai" : "neutral"}
          />
          <KeyVal
            label="Correction applied"
            value={cd.correction_applied ? "Yes" : "No"}
            tone={cd.correction_applied ? "success" : "neutral"}
          />
        </div>

        <Panel title="Reason">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
            {cd.reason?.trim() ? cd.reason : "No reason recorded"}
          </p>
        </Panel>

        {original === null ? (
          <>
            <Panel className="border-info-line bg-info-subtle">
              <p className="flex items-start gap-2 text-xs leading-snug text-info-surface-fg break-words">
                <Icon name="alertCircle" size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Original generated answer was not recorded for this trace.</span>
              </p>
            </Panel>
            <Panel
              title="Final answer"
              action={<CopyButton text={final} label="Copy" size="xs" />}
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                {final}
              </p>
            </Panel>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div
                className="inline-flex rounded-md border border-line bg-sunken p-0.5"
                role="group"
                aria-label="Answer comparison view"
              >
                <button
                  type="button"
                  onClick={() => setView("diff")}
                  aria-pressed={view === "diff"}
                  title="Inline diff view"
                  aria-label="Inline diff view"
                  className={`rounded px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    view === "diff"
                      ? "bg-brand text-white"
                      : "text-fg-muted hover:bg-hover hover:text-fg"
                  }`}
                >
                  Diff
                </button>
                <button
                  type="button"
                  onClick={() => setView("split")}
                  aria-pressed={view === "split"}
                  title="Side-by-side view"
                  aria-label="Side-by-side view"
                  className={`rounded px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    view === "split"
                      ? "bg-brand text-white"
                      : "text-fg-muted hover:bg-hover hover:text-fg"
                  }`}
                >
                  Split
                </button>
              </div>

              {view === "diff" ? (
                <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-sm bg-success-subtle ring-1 ring-success-line"
                      aria-hidden="true"
                    />
                    Added
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-sm bg-danger-subtle ring-1 ring-danger-line"
                      aria-hidden="true"
                    />
                    Removed
                  </span>
                </div>
              ) : null}
            </div>

            {view === "diff" ? (
              <Panel title="Diff (original → final)">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {diffWords(original, final).map((seg, i) => {
                    if (seg.type === "same") {
                      return (
                        <span key={i} className="text-fg-muted">
                          {seg.text}
                        </span>
                      );
                    }
                    if (seg.type === "add") {
                      return (
                        <span
                          key={i}
                          className="rounded bg-success-subtle px-0.5 text-success-surface-fg"
                        >
                          {seg.text}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={i}
                        className="rounded bg-danger-subtle px-0.5 text-danger-surface-fg line-through"
                      >
                        {seg.text}
                      </span>
                    );
                  })}
                </p>
              </Panel>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                <Panel
                  title="Original generated"
                  action={<CopyButton text={original} label="Copy" size="xs" />}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
                    {original}
                  </p>
                </Panel>
                <Panel
                  title="Final answer"
                  action={<CopyButton text={final} label="Copy" size="xs" />}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                    {final}
                  </p>
                </Panel>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 8) LLM Usage
 * ──────────────────────────────────────────────────────────── */
const NOT_CAPTURED = "Not captured";

export function LlmUsage({ trace }: { trace: RagTraceDetail }) {
  const usage = extractUsage(trace);
  const genMs = trace.latency_summary.by_agent_type["generator"];
  const gen = getAgentRun(trace.agent_runs, "generator");

  const tiles: { label: string; value: string; captured: boolean }[] = [
    {
      label: "Prompt Tokens",
      value: usage.promptTokens != null ? fmtNumber(usage.promptTokens) : NOT_CAPTURED,
      captured: usage.promptTokens != null,
    },
    {
      label: "Completion Tokens",
      value: usage.completionTokens != null ? fmtNumber(usage.completionTokens) : NOT_CAPTURED,
      captured: usage.completionTokens != null,
    },
    {
      label: "Total Tokens",
      value: usage.totalTokens != null ? fmtNumber(usage.totalTokens) : NOT_CAPTURED,
      captured: usage.totalTokens != null,
    },
    {
      label: "Model",
      value: usage.model ?? NOT_CAPTURED,
      captured: usage.model != null,
    },
    {
      label: "Generation Time",
      value: formatLatency(genMs),
      captured: genMs != null,
    },
    {
      label: "Cost Estimate",
      value: usage.costUsd != null ? `$${usage.costUsd.toFixed(4)}` : NOT_CAPTURED,
      captured: usage.costUsd != null,
    },
  ];

  return (
    <Section
      id="usage"
      num={8}
      icon="cpu"
      title="LLM Usage"
      subtitle="Generation timing, tokens, model, and cost"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="min-w-0 rounded-lg border border-line bg-sunken p-3"
            >
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                {t.label}
              </p>
              <p
                className={`mt-1 truncate text-sm font-semibold tabular-nums ${
                  t.captured ? "text-fg" : "text-fg-subtle"
                }`}
                title={t.value}
              >
                {t.value}
              </p>
            </div>
          ))}
        </div>

        {usage.found === false ? (
          <Panel className="border-info-line bg-info-subtle">
            <p className="flex items-start gap-2 text-xs leading-snug text-info-surface-fg break-words">
              <Icon name="alertCircle" size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Token usage, model, and cost are not recorded in this trace&apos;s agent runs.
                Generation latency is shown from the pipeline timing.
              </span>
            </p>
          </Panel>
        ) : null}

        {gen ? (
          <div className="flex min-w-0 flex-col gap-3">
            <details className="min-w-0 rounded-lg border border-line bg-sunken">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="chevronDown" size={14} className="text-fg-subtle" aria-hidden="true" />
                  Generator input (prompt &amp; context)
                </span>
                <span onClick={(e) => e.preventDefault()}>
                  <CopyButton text={previewText(gen.input_preview)} label="Copy" size="xs" />
                </span>
              </summary>
              <div className="border-t border-line p-3">
                <pre className="max-h-72 overflow-auto rounded-md bg-canvas p-3 font-mono text-xs leading-5 text-fg-muted">
                  {previewText(gen.input_preview)}
                </pre>
              </div>
            </details>

            <details className="min-w-0 rounded-lg border border-line bg-sunken">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="chevronDown" size={14} className="text-fg-subtle" aria-hidden="true" />
                  Generator output
                </span>
                <span onClick={(e) => e.preventDefault()}>
                  <CopyButton text={previewText(gen.output_preview ?? {})} label="Copy" size="xs" />
                </span>
              </summary>
              <div className="border-t border-line p-3">
                <pre className="max-h-72 overflow-auto rounded-md bg-canvas p-3 font-mono text-xs leading-5 text-fg-muted">
                  {previewText(gen.output_preview ?? {})}
                </pre>
              </div>
            </details>
          </div>
        ) : (
          <Panel>
            <p className="flex items-center gap-2 text-xs text-fg-subtle">
              <Icon name="alertCircle" size={14} className="shrink-0" aria-hidden="true" />
              Generator run not recorded.
            </p>
          </Panel>
        )}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Raw Trace JSON (debug)
 * ──────────────────────────────────────────────────────────── */
export function JsonDebug({ trace }: { trace: RagTraceDetail }) {
  const json = JSON.stringify(sanitizeDebug(trace.raw_debug), null, 2);

  return (
    <Section icon="code" title="Raw Trace JSON" subtitle="Debug — collapsed by default">
      <details className="min-w-0 rounded-lg border border-line bg-sunken">
        <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="chevronDown" size={14} className="text-fg-subtle" aria-hidden="true" />
          Show raw safe JSON
        </summary>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center justify-end">
            <CopyButton text={json} label="Copy JSON" size="xs" />
          </div>
          <pre className="mt-3 max-h-[480px] overflow-auto rounded-md bg-slate-900 p-4 text-xs leading-5 text-slate-100">
            {json}
          </pre>
        </div>
      </details>
    </Section>
  );
}
