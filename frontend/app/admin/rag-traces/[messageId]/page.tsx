"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  formatDecimal,
  formatNumber,
} from "@/components/admin/AdminUI";
import {
  AgentTimeline,
  CitationCard,
  EmptyState,
  ErrorCard,
  EvaluationRadarChart,
  formatLatency,
  getHallucinationRisk,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  QualityBadge,
  RefreshButton,
  RerankingComparisonChart,
  RiskBadge,
  safePreview,
  sanitizeDebugJson,
  shortenId,
  StatCard,
  StatusBadge,
  TraceFlowDiagram,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  getRagTrace,
  getRagTraceEvaluation,
  getRagTraceReranking,
  getRagTraceRetrieval,
} from "@/lib/admin";
import type {
  RagTraceAgentRun,
  RagTraceDetail,
  RagTraceEvaluationDetails,
  RagTraceRerankingDetails,
  RagTraceRetrievalDetails,
} from "@/types";

const AGENT_ORDER = [
  "router",
  "query_rewriter",
  "retrieval",
  "reranker",
  "generator",
  "evaluator",
  "corrector",
];

export default function RagTraceDetailPage() {
  const params = useParams<{ messageId: string }>();
  const { isAdmin, isLoading, isSuperAdmin } = useAdminAccess();
  const [trace, setTrace] = useState<RagTraceDetail | null>(null);
  const [retrieval, setRetrieval] = useState<RagTraceRetrievalDetails | null>(null);
  const [reranking, setReranking] = useState<RagTraceRerankingDetails | null>(null);
  const [evaluation, setEvaluation] = useState<RagTraceEvaluationDetails | null>(null);
  const [includeContent, setIncludeContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const messageId = params.messageId;

  const load = useCallback(async () => {
    if (!isAdmin || !messageId) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const [traceData, retrievalData, rerankingData, evaluationData] = await Promise.all([
        getRagTrace(messageId, includeContent),
        getRagTraceRetrieval(messageId, includeContent),
        getRagTraceReranking(messageId, includeContent),
        getRagTraceEvaluation(messageId),
      ]);
      setTrace(traceData);
      setRetrieval(retrievalData);
      setReranking(rerankingData);
      setEvaluation(evaluationData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load RAG trace.");
    } finally {
      setIsFetching(false);
    }
  }, [includeContent, isAdmin, messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isSuperAdmin && includeContent) {
      setIncludeContent(false);
    }
  }, [includeContent, isSuperAdmin]);

  const orderedAgentRuns = useMemo(() => orderAgents(trace?.agent_runs ?? []), [trace]);
  const risk = trace ? getHallucinationRisk(metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score)) : null;

  if (isLoading) {
    return <AdminAccessMessage title="RAG Trace" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="RAG Trace" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="One-page RAG answer story from question to final corrected response."
    >
      <PageHeader
        title="RAG Trace Detail"
        subtitle="Question -> Retrieval -> Reranking -> Generation -> Evaluation -> Correction -> Final Answer."
        actions={
          <>
            <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeContent}
                disabled={!isSuperAdmin}
                onChange={(event) => setIncludeContent(event.target.checked)}
              />
              Full chunk content
            </label>
            <RefreshButton isFetching={isFetching} onClick={() => void load()} />
          </>
        }
      />
      {!isSuperAdmin ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Full chunk content is restricted to super admins. This page uses safe previews by default.
        </p>
      ) : includeContent ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Full chunk content is visible because super admin access and include_content are enabled.
        </p>
      ) : null}
      <ErrorCard message={error} onRetry={() => void load()} />

      {isFetching && !trace ? <LoadingSkeleton rows={5} /> : null}

      {trace ? (
        <div className="grid gap-6">
          <section className="sticky top-2 z-10 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <SummaryItem label="Message" value={shortenId(trace.message_id)} />
              <SummaryItem label="Workspace" value={trace.workspace.name} />
              <SummaryItem label="User" value={trace.user.email ?? "Unknown"} />
              <SummaryItem label="Strategy" value={trace.retrieval_strategy ?? "unknown"} />
              <SummaryItem label="Latency" value={formatLatency(trace.latency_summary.total_latency_ms)} />
              <SummaryItem label="Quality" value={qualityStatus(trace, evaluation)} />
              <div className="flex items-center gap-2">
                {risk ? <StatusBadge label={risk.label} tone={risk.tone} /> : null}
                <StatusBadge
                  label={trace.corrector_decision.corrected ? "Corrected" : "Original"}
                  tone={trace.corrector_decision.corrected ? "ai" : "neutral"}
                />
              </div>
            </div>
          </section>

          <TraceFlowDiagram
            steps={[
              { label: "Question", status: "completed", latencyMs: 0 },
              {
                label: "Query Rewrite",
                status: statusForAgent(orderedAgentRuns, "query_rewriter"),
                latencyMs: trace.latency_summary.by_agent_type.query_rewriter,
                description: retrieval?.rewritten_query ?? "No rewrite recorded",
              },
              {
                label: "Retrieval",
                status: statusForAgent(orderedAgentRuns, "retrieval"),
                latencyMs: trace.latency_summary.by_agent_type.retrieval,
                description: `${trace.retrieved_chunks.length} chunks`,
              },
              {
                label: "Reranking",
                status: statusForAgent(orderedAgentRuns, "reranker"),
                latencyMs: trace.latency_summary.by_agent_type.reranker,
                description: `${reranking?.items.length ?? 0} compared`,
              },
              {
                label: "Generation",
                status: statusForAgent(orderedAgentRuns, "generator"),
                latencyMs: trace.latency_summary.by_agent_type.generator,
              },
              {
                label: "Evaluation",
                status: statusForAgent(orderedAgentRuns, "evaluator"),
                latencyMs: trace.latency_summary.by_agent_type.evaluator,
              },
              {
                label: "Correction",
                status: statusForAgent(orderedAgentRuns, "corrector"),
                latencyMs: trace.latency_summary.by_agent_type.corrector,
                description: trace.corrector_decision.corrected ? "Answer changed" : "No change",
              },
              { label: "Final Answer", status: "completed", latencyMs: 0 },
            ]}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-2">
              <TextPanel label="User Question" value={trace.user_question} />
              <TextPanel label="Final Assistant Answer" value={trace.assistant_answer} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge label={`${formatNumber(trace.citations.length)} citations`} tone={trace.citations.length > 0 ? "success" : "warning"} />
              <QualityBadge label="Faithfulness" value={metric(evaluation?.faithfulness, trace.evaluation.faithfulness)} />
              <QualityBadge label="Relevance" value={metric(evaluation?.relevance, trace.evaluation.relevance)} />
              <RiskBadge value={metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score)} />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Faithfulness"
              value={formatDecimal(metric(evaluation?.faithfulness, trace.evaluation.faithfulness), 2)}
              description="Grounding against cited context"
              progress={metric(evaluation?.faithfulness, trace.evaluation.faithfulness) * 100}
              badge="Evaluation"
              tone={metric(evaluation?.faithfulness, trace.evaluation.faithfulness) >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Relevance"
              value={formatDecimal(metric(evaluation?.relevance, trace.evaluation.relevance), 2)}
              description="Fit to the original question"
              progress={metric(evaluation?.relevance, trace.evaluation.relevance) * 100}
              badge="Evaluation"
              tone={metric(evaluation?.relevance, trace.evaluation.relevance) >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Context Precision"
              value={formatDecimal(metric(evaluation?.context_precision, trace.evaluation.context_precision), 2)}
              description="How much retrieved context was useful"
              progress={metric(evaluation?.context_precision, trace.evaluation.context_precision) * 100}
              badge="Retrieval"
              tone={metric(evaluation?.context_precision, trace.evaluation.context_precision) >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Hallucination"
              value={formatDecimal(metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score), 2)}
              description="Lower is safer"
              progress={metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score) * 100}
              badge="Risk"
              tone={metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score) <= 0.3 ? "success" : "critical"}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <EvaluationRadarChart
              faithfulness={metric(evaluation?.faithfulness, trace.evaluation.faithfulness)}
              relevance={metric(evaluation?.relevance, trace.evaluation.relevance)}
              contextPrecision={metric(evaluation?.context_precision, trace.evaluation.context_precision)}
              hallucinationScore={metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score)}
              retrievalCoverage={metric(evaluation?.context_recall ?? undefined, trace.evaluation.context_recall ?? trace.evaluation.context_precision)}
              title="Evaluation Radar"
            />
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Evaluation Explanation</h3>
              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {evaluation?.explanation ?? trace.evaluation.explanation}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge
                  label={`Method ${evaluation?.evaluation_method ?? trace.evaluation.evaluation_method}`}
                  tone="ai"
                />
                <StatusBadge
                  label={
                    evaluation?.corrector_changed_answer ?? trace.evaluation.corrector_changed_answer
                      ? "Corrector changed answer"
                      : "No correction"
                  }
                  tone={
                    evaluation?.corrector_changed_answer ?? trace.evaluation.corrector_changed_answer
                      ? "ai"
                      : "neutral"
                  }
                />
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Retrieved Chunks</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Original query: {safePreview(retrieval?.original_query ?? trace.user_question, 180)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Rewritten query: {retrieval?.rewritten_query ? safePreview(retrieval.rewritten_query, 180) : "Not rewritten"}
                </p>
              </div>
              <StatusBadge
                label={retrieval?.retrieval_strategy ?? trace.retrieval_strategy ?? "unknown"}
                tone="info"
              />
            </div>
            {(retrieval?.retrieved_chunks ?? trace.retrieved_chunks).length === 0 ? (
              <div className="mt-5">
                <EmptyState label="No retrieved chunks were recorded." />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(retrieval?.retrieved_chunks ?? trace.retrieved_chunks).map((chunk) => {
                  const used = trace.citations.some((citation) => citation.chunk_id === chunk.chunk_id);
                  return (
                    <article
                      key={`${chunk.chunk_id ?? chunk.filename}-${chunk.rank}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-blue-700">
                            Rank {chunk.rank}
                          </p>
                          <h4 className="mt-1 truncate text-sm font-semibold text-slate-950">
                            {chunk.filename}
                          </h4>
                          <p className="mt-1 text-xs text-slate-500">
                            chunk {chunk.chunk_index} - score {formatDecimal(chunk.score, 3)}
                          </p>
                        </div>
                        <StatusBadge
                          label={used ? "Cited" : "Retrieved"}
                          tone={used ? "success" : "neutral"}
                        />
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-700">
                        {safePreview(chunk.content ?? chunk.content_preview, 260)}
                      </p>
                      <div className="mt-4 grid gap-2">
                        {Object.entries(chunk.source_scores).map(([name, value]) => (
                          <div key={name}>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{name}</span>
                              <span>{formatDecimal(value, 3)}</span>
                            </div>
                            <ProgressBar value={Math.max(0, Math.min(value * 100, 100))} tone="info" />
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <RerankingComparisonChart items={reranking?.items ?? []} />

          {reranking && reranking.items.length > 0 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Reranking Detail</h3>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {reranking.items.map((item) => (
                  <article
                    key={`${item.chunk_id ?? item.filename}-${item.original_rank}-${item.final_rank}`}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-950">
                          {item.filename}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Original rank #{item.original_rank ?? "n/a"} to final rank #
                          {item.final_rank ?? "n/a"}
                        </p>
                      </div>
                      <StatusBadge
                        label={item.used_in_final_citations ? "Used" : "Unused"}
                        tone={item.used_in_final_citations ? "success" : "neutral"}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {safePreview(item.chunk_preview, 180)}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <RerankMetric
                        label="Original score"
                        value={formatDecimal(item.original_score, 4)}
                      />
                      <RerankMetric
                        label="Rerank score"
                        value={formatOptionalScore(item.rerank_score)}
                      />
                      <RerankMetric
                        label="Exact matches"
                        value={item.exact_matches === null ? "n/a" : formatNumber(item.exact_matches)}
                      />
                      <RerankMetric
                        label="Overlap"
                        value={formatOptionalScore(item.overlap)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-950">Citation Panel</h3>
            {trace.citations.length === 0 ? (
              <div className="mt-5">
                <EmptyState label="No citations were stored for this answer." />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {trace.citations.map((citation) => (
                  <CitationCard key={`${citation.document_id}-${citation.chunk_id}`} citation={citation} />
                ))}
              </div>
            )}
          </section>

          <AgentTimeline runs={orderedAgentRuns} />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Corrector Decision</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Shows whether CorrectorAgent changed the generated answer before final output.
                </p>
              </div>
              <StatusBadge
                label={trace.corrector_decision.corrected ? "Corrected" : "No correction"}
                tone={trace.corrector_decision.corrected ? "ai" : "neutral"}
              />
            </div>
            {isRefusalDespiteCitations(trace.assistant_answer, trace.citations.length) ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Warning: the final answer appears to refuse or claim missing context even though citations exist.
              </p>
            ) : null}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <InfoPanel
                label="Reason"
                value={trace.corrector_decision.reason ?? "No reason recorded"}
              />
              <InfoPanel
                label="Original Generated Answer"
                value={trace.corrector_decision.generated_answer_preview ?? "Not recorded"}
              />
              <InfoPanel
                label="Final Answer Preview"
                value={trace.corrector_decision.final_answer_preview ?? safePreview(trace.assistant_answer, 260)}
              />
              <InfoPanel
                label="Correction Applied"
                value={trace.corrector_decision.correction_applied ? "Yes" : "No"}
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <details>
              <summary className="cursor-pointer text-base font-semibold text-slate-950">
                Raw Safe JSON Debug
              </summary>
              <pre className="mt-5 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {JSON.stringify(sanitizeDebugJson(trace.raw_debug), null, 2)}
              </pre>
            </details>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}

function TextPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {safePreview(value, 520)}
      </p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function orderAgents(runs: RagTraceAgentRun[]) {
  const grouped = new Map<string, RagTraceAgentRun[]>();
  runs.forEach((run) => {
    grouped.set(run.agent_type, [...(grouped.get(run.agent_type) ?? []), run]);
  });
  const ordered = AGENT_ORDER.flatMap((agentType) => grouped.get(agentType) ?? []);
  const extras = runs.filter((run) => !AGENT_ORDER.includes(run.agent_type));
  return [...ordered, ...extras];
}

function statusForAgent(runs: RagTraceAgentRun[], agentType: string) {
  const run = runs.find((item) => item.agent_type === agentType);
  if (!run) {
    return "completed";
  }
  return run.status;
}

function metric(value: number | null | undefined, fallback: number) {
  return value === null || value === undefined ? fallback : value;
}

function qualityStatus(trace: RagTraceDetail, evaluation: RagTraceEvaluationDetails | null) {
  const faithfulness = metric(evaluation?.faithfulness, trace.evaluation.faithfulness);
  const hallucination = metric(evaluation?.hallucination_score, trace.evaluation.hallucination_score);
  if (faithfulness >= 0.75 && hallucination <= 0.3) {
    return "Healthy";
  }
  if (faithfulness >= 0.5 && hallucination <= 0.6) {
    return "Warning";
  }
  return "Critical";
}

function formatOptionalScore(value: number | undefined | null) {
  return value === undefined || value === null ? "n/a" : formatDecimal(value, 4);
}

function isRefusalDespiteCitations(answer: string, citationCount: number) {
  if (citationCount === 0) {
    return false;
  }
  return /no context|not enough context|cannot answer|can't answer|do not have enough/i.test(answer);
}

function RerankMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
