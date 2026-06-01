"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import {
  Section,
  CopyButton,
  ToneBadge,
  AgentStatusChip,
  KeyVal,
  Panel,
  toneBar,
  toneText,
} from "@/features/trace-inspector/components/primitives";
import {
  AGENT_ORDER,
  AGENT_META,
  agentLabel,
  agentIcon,
  getAgentRun,
  agentStatus,
  resolveScores,
  traceHealthScore,
  healthTone,
  scoreTone,
  riskLevel,
  previewText,
  formatLatency,
  shortenId,
  type AgentStatus,
  type Tone,
} from "@/features/trace-inspector/helpers";
import type { RagTraceDetail, RagTraceEvaluationDetails } from "@/types";

/* ════════════════════════════════════════════════════════════════
   1) TraceSummary
   ════════════════════════════════════════════════════════════════ */

export function TraceSummary({
  trace,
  evaluation,
}: {
  trace: RagTraceDetail;
  evaluation: RagTraceEvaluationDetails | undefined;
}) {
  const scores = resolveScores(trace, evaluation);
  const health = traceHealthScore({
    faithfulness: scores.faithfulness,
    relevance: scores.relevance,
    hallucination: scores.hallucination,
    latencyMs: trace.latency_summary.total_latency_ms,
  });
  const hTone = healthTone(health);
  const risk = riskLevel(scores.hallucination);

  const userEmail = trace.user.email ?? null;
  const strategy = trace.retrieval_strategy ?? null;

  // SVG ring geometry
  const R = 34;
  const C = 2 * Math.PI * R;
  const ringPct = Math.max(0, Math.min(100, health));
  const dash = (ringPct / 100) * C;

  const ringStroke: Record<Tone, string> = {
    success: "stroke-success",
    warning: "stroke-warning",
    danger: "stroke-danger",
    info: "stroke-info",
    ai: "stroke-brand",
    neutral: "stroke-line-strong",
  };

  return (
    <Section id="summary" num={1} icon="layers" title="Trace Summary">
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* Health Score tile */}
        <div className="flex min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-sunken p-4 sm:flex-row lg:flex-col lg:items-center">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center">
            <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
              <circle cx="40" cy="40" r={R} fill="none" strokeWidth="8" className="stroke-line" />
              <circle
                cx="40"
                cy="40"
                r={R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={ringStroke[hTone]}
                strokeDasharray={`${dash} ${C}`}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className={`text-2xl font-bold tabular-nums ${toneText[hTone]}`}>{health}</span>
            </div>
          </div>
          <div className="min-w-0 text-center lg:text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Health Score</p>
            <p className={`text-sm font-semibold ${toneText[hTone]}`}>{health} / 100</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <ToneBadge tone={risk.tone} label={risk.label} icon="shield" />
              {trace.corrector_decision.corrected ? (
                <ToneBadge tone="ai" label="Corrected" icon="checkCircle" />
              ) : (
                <ToneBadge tone="neutral" label="Original" icon="fileText" />
              )}
            </div>
          </div>
        </div>

        {/* KeyVal grid */}
        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-4">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Message</p>
              <CopyButton text={trace.message_id} label="ID" size="xs" />
            </div>
            <p className="mt-0.5 truncate font-mono text-xs font-medium text-fg" title={trace.message_id}>
              {shortenId(trace.message_id)}
            </p>
          </div>
          <KeyVal label="Workspace" value={trace.workspace.name || "—"} />
          <KeyVal label="User" value={userEmail ?? "—"} />
          <KeyVal label="Strategy" value={strategy ?? "—"} mono={!!strategy} />
          <KeyVal label="Latency" value={formatLatency(trace.latency_summary.total_latency_ms)} />
          <KeyVal
            label="Faithfulness"
            value={scores.faithfulness.toFixed(2)}
            tone={scoreTone(scores.faithfulness)}
          />
          <KeyVal label="Relevance" value={scores.relevance.toFixed(2)} tone={scoreTone(scores.relevance)} />
          <KeyVal
            label="Hallucination"
            value={scores.hallucination.toFixed(2)}
            tone={scoreTone(scores.hallucination, true)}
          />

          {/* Quick-read faithfulness/relevance bars */}
          <div className="col-span-2 min-w-0 md:col-span-3 xl:col-span-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <QuickBar label="Faithfulness" value={scores.faithfulness} />
              <QuickBar label="Relevance" value={scores.relevance} />
            </div>
          </div>
        </div>
      </div>

      {/* Question + Final Answer panels */}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <TextPanel title="Question" text={trace.question} icon="message" />
        <TextPanel title="Final Answer" text={trace.answer} icon="sparkles" />
      </div>
    </Section>
  );
}

function QuickBar({ label, value }: { label: string; value: number }) {
  const tone = scoreTone(value);
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-fg-muted">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-fg">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TextPanel({ title, text, icon }: { title: string; text: string; icon: IconName }) {
  const trimmed = (text ?? "").trim();
  const has = trimmed.length > 0;
  return (
    <Panel
      title={title}
      action={has ? <CopyButton text={trimmed} label="Copy" size="xs" /> : undefined}
    >
      {has ? (
        <div className="min-w-0">
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm text-fg">{trimmed}</p>
          {trimmed.length > 220 ? (
            <details className="group mt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-xs font-medium text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <Icon name="chevronRight" size={12} className="transition group-open:rotate-90" aria-hidden="true" />
                Show full
              </summary>
              <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-line-subtle bg-canvas p-2 text-sm text-fg">
                {trimmed}
              </p>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-fg-subtle">
          <Icon name={icon} size={12} className="mr-1 inline align-text-bottom" aria-hidden="true" />
          Not recorded
        </p>
      )}
    </Panel>
  );
}

/* ════════════════════════════════════════════════════════════════
   2) AgentTimeline
   ════════════════════════════════════════════════════════════════ */

const STATUS_RING: Record<AgentStatus, string> = {
  completed: "border-success-line bg-success-subtle text-success-fg",
  failed: "border-danger-line bg-danger-subtle text-danger-fg",
  running: "border-info-line bg-info-subtle text-info-fg",
  skipped: "border-line bg-sunken text-fg-subtle",
};

export function AgentTimeline({ trace }: { trace: RagTraceDetail }) {
  const extras = trace.agent_runs.filter((r) => !AGENT_ORDER.includes(r.agent_type));
  const nodes: string[] = [...AGENT_ORDER, ...extras.map((r) => r.agent_type)];

  return (
    <Section
      id="timeline"
      num={2}
      icon="activity"
      title="Agent Timeline"
      subtitle="Router → Query Rewriter → Retriever → Reranker → Generator → Evaluator → Corrector"
    >
      <ol className="relative min-w-0 space-y-4">
        {nodes.map((agentType, idx) => {
          const run = getAgentRun(trace.agent_runs, agentType);
          const status = agentStatus(run);
          const isLast = idx === nodes.length - 1;
          const skipped = status === "skipped";
          const latency = formatLatency(run?.latency_ms ?? trace.latency_summary.by_agent_type[agentType]);
          const hasIO = !!run && (Object.keys(run.input_preview ?? {}).length > 0 || !!run.output_preview);

          return (
            <li key={`${agentType}-${idx}`} className={`relative min-w-0 pl-12 ${skipped ? "opacity-60" : ""}`}>
              {/* rail */}
              {!isLast ? (
                <span className="absolute left-[19px] top-10 bottom-[-1rem] w-px bg-line" aria-hidden="true" />
              ) : null}
              {/* node circle */}
              <span
                className={`absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full border ${STATUS_RING[status]}`}
                aria-hidden="true"
              >
                <Icon name={agentIcon(agentType)} size={16} />
              </span>

              <div className="min-w-0 rounded-lg border border-line bg-surface p-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-fg">{agentLabel(agentType)}</p>
                  <AgentStatusChip status={status} />
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-fg-muted">
                    <Icon name="clock" size={12} aria-hidden="true" />
                    {latency}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-xs text-fg-subtle">
                  {AGENT_META[agentType]?.description ?? "Custom pipeline step"}
                </p>

                {run?.error ? (
                  <div className="mt-2 min-w-0 rounded-md border border-danger-line bg-danger-subtle p-2">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-danger-fg">
                      <Icon name="alertCircle" size={12} aria-hidden="true" />
                      Error
                    </p>
                    <pre className="mt-1 max-h-40 overflow-x-auto whitespace-pre-wrap break-words text-xs text-danger-surface-fg">
                      {run.error}
                    </pre>
                  </div>
                ) : null}

                {!skipped && hasIO ? (
                  <details className="group mt-2 min-w-0">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-xs font-medium text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                      <Icon name="chevronRight" size={12} className="transition group-open:rotate-90" aria-hidden="true" />
                      Input / Output
                    </summary>
                    <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
                      <IOBlock title="Input" text={previewText(run!.input_preview)} />
                      <IOBlock title="Output" text={previewText(run!.output_preview ?? {})} />
                    </div>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function IOBlock({ title, text }: { title: string; text: string }) {
  const has = text.trim().length > 0 && text.trim() !== "{}";
  return (
    <div className="min-w-0 rounded-md border border-line-subtle bg-sunken">
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-2 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</p>
        {has ? <CopyButton text={text} label="Copy" size="xs" /> : null}
      </div>
      {has ? (
        <pre className="max-h-56 overflow-x-auto overflow-y-auto whitespace-pre p-2 font-mono text-[11px] leading-relaxed text-fg">
          {text}
        </pre>
      ) : (
        <p className="px-2 py-2 text-xs text-fg-subtle">Not recorded</p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   3) TraceGraph
   ════════════════════════════════════════════════════════════════ */

type GraphNode = {
  key: string;
  label: string;
  icon: IconName;
  anchor: string;
  agentType: string | null; // null => always completed terminal
};

const GRAPH_NODES: GraphNode[] = [
  { key: "question", label: "Question", icon: "message", anchor: "#summary", agentType: null },
  { key: "retrieval", label: "Retrieval", icon: "search", anchor: "#retrieval", agentType: "retrieval" },
  { key: "reranking", label: "Reranking", icon: "activity", anchor: "#reranking", agentType: "reranker" },
  { key: "generation", label: "Generation", icon: "sparkles", anchor: "#usage", agentType: "generator" },
  { key: "evaluation", label: "Evaluation", icon: "shield", anchor: "#evaluation", agentType: "evaluator" },
  { key: "correction", label: "Correction", icon: "checkCircle", anchor: "#corrector", agentType: "corrector" },
  { key: "final", label: "Final Answer", icon: "checkCircle", anchor: "#citations", agentType: null },
];

const NODE_TONE: Record<AgentStatus, { box: string; dot: string }> = {
  completed: { box: "border-success-line bg-success-subtle", dot: "bg-success" },
  failed: { box: "border-danger-line bg-danger-subtle", dot: "bg-danger" },
  running: { box: "border-info-line bg-info-subtle", dot: "bg-info" },
  skipped: { box: "border-line bg-sunken", dot: "bg-line-strong" },
};

export function TraceGraph({ trace }: { trace: RagTraceDetail }) {
  return (
    <Section
      id="graph"
      num={9}
      icon="selector"
      title="Trace Graph"
      subtitle="Question → Retrieval → Reranking → Generation → Evaluation → Correction → Final Answer"
    >
      {/* Wide screens: horizontal flow with arrow connectors. Narrow: wrapping grid, no scroll. */}
      <nav aria-label="Pipeline trace graph" className="min-w-0">
        <ul className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:flex-nowrap xl:items-stretch xl:gap-0">
          {GRAPH_NODES.map((node, idx) => {
            const status: AgentStatus = node.agentType
              ? agentStatus(getAgentRun(trace.agent_runs, node.agentType))
              : "completed";
            const tone = NODE_TONE[status];
            const latency =
              node.agentType != null && trace.latency_summary.by_agent_type[node.agentType] != null
                ? formatLatency(trace.latency_summary.by_agent_type[node.agentType])
                : null;
            const isLast = idx === GRAPH_NODES.length - 1;

            return (
              <li key={node.key} className="flex min-w-0 items-stretch xl:flex-1">
                <a
                  href={node.anchor}
                  aria-label={`${node.label} — status ${status}. Jump to section.`}
                  title={`${node.label} (${status})`}
                  className={`group flex min-w-0 flex-1 flex-col gap-1 rounded-lg border ${tone.box} p-2.5 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface">
                      <Icon name={node.icon} size={13} className="text-fg-muted" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 truncate text-xs font-semibold text-fg">{node.label}</span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] capitalize text-fg-subtle">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                      {status}
                    </span>
                    {latency ? (
                      <span className="shrink-0 truncate text-[10px] tabular-nums text-fg-muted">{latency}</span>
                    ) : null}
                  </div>
                </a>

                {/* arrow connector — only on wide (xl) flow layout */}
                {!isLast ? (
                  <span className="hidden shrink-0 items-center px-1 xl:flex" aria-hidden="true">
                    <Icon name="arrowRight" size={14} className="text-fg-subtle" />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </Section>
  );
}
