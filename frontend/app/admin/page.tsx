"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ErrorBanner,
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/components/admin/AdminUI";
import { MetricStrip, type Metric, type Tone } from "@/components/admin/DataView";
import {
  ScoreMeter,
  HBarChart,
  StackedBar,
  HealthRing,
  agentLatencyRows,
  barBg,
} from "@/components/admin/AdminCharts";
import { Badge, DataCard, EmptyState, LoadingState, StatusBadge } from "@/components/ui";
import type { StatusTone } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  getAdminDocumentsStats,
  getAdminStats,
  getRagTraceQualitySummary,
  listAdminAuditLogs,
  listAdminErrors,
  listRagOpsWorkspaces,
} from "@/lib/admin";
import type {
  AdminAuditLogSummary,
  AdminDocumentSummary,
  AdminErrorSummary,
  AdminStats,
  RagOpsWorkspaceSummary,
  RagTraceQualitySummary,
} from "@/types";

const STATUS_TONE: Record<string, StatusTone> = {
  indexed: "success",
  processing: "warning",
  queued: "info",
  uploaded: "info",
  failed: "critical",
  deleted: "neutral",
};
const STATUS_ORDER = ["indexed", "processing", "queued", "uploaded", "failed", "deleted"];

function kpiTone(value: number, invert = false): Tone {
  if (invert) return value <= 0.3 ? "success" : value <= 0.6 ? "warning" : "danger";
  return value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "danger";
}
function healthKpiTone(score: number): Tone {
  return score >= 80 ? "success" : score >= 55 ? "warning" : "danger";
}

export default function AdminPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [documents, setDocuments] = useState<AdminDocumentSummary[]>([]);
  const [errors, setErrors] = useState<AdminErrorSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogSummary[]>([]);
  const [ragOpsWorkspaces, setRagOpsWorkspaces] = useState<RagOpsWorkspaceSummary[]>([]);
  const [quality, setQuality] = useState<RagTraceQualitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const [statsData, documentsData, errorsData, ragOpsData, qualityData, auditData] = await Promise.all([
        getAdminStats(),
        getAdminDocumentsStats(),
        listAdminErrors(),
        listRagOpsWorkspaces(),
        getRagTraceQualitySummary(),
        listAdminAuditLogs({ page: 1, page_size: 20 }),
      ]);
      setStats(statsData);
      setDocuments(documentsData.recent_documents);
      setErrors(errorsData.errors);
      setRagOpsWorkspaces(ragOpsData);
      setQuality(qualityData);
      setAuditLogs(auditData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load admin data.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const aggregate = useMemo(() => aggregateRagOps(ragOpsWorkspaces), [ragOpsWorkspaces]);
  const overview = useMemo(() => buildOverview(stats, quality, aggregate, errors), [aggregate, errors, quality, stats]);

  const failedDocuments = documents.filter((d) => d.status === "failed").slice(0, 5);
  const riskyAnswers = quality?.worst_messages_by_hallucination.slice(0, 5) ?? [];
  const riskyActions = auditLogs
    .filter((log) => ["DELETE", "DEACTIVATE", "ROLE", "RETRY"].some((k) => log.action.toUpperCase().includes(k)))
    .slice(0, 5);

  if (isLoading) return <AdminAccessMessage title="Operations Overview" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="Operations Overview" label="Admin access required." />;

  const kpis: Metric[] = stats && overview
    ? [
        { label: "Platform health", value: `${overview.healthScore}/100`, icon: "activity", tone: healthKpiTone(overview.healthScore) },
        { label: "Users", value: formatNumber(stats.users.total), hint: `${formatNumber(stats.users.active)} active`, icon: "user", tone: "info" },
        { label: "Workspaces", value: formatNumber(stats.total_workspaces), icon: "layers", tone: "brand" },
        { label: "Documents", value: formatNumber(stats.total_documents), hint: `${formatNumber(overview.indexedDocuments)} indexed`, icon: "fileText", tone: "neutral" },
        { label: "RAG queries", value: formatNumber(stats.total_rag_queries), hint: `avg ${overview.avgLatencyLabel}`, icon: "message", tone: "info" },
        { label: "Avg faithfulness", value: `${Math.round(overview.faithfulness * 100)}%`, icon: "shield", tone: kpiTone(overview.faithfulness) },
        { label: "Hallucination", value: `${Math.round(overview.hallucinationScore * 100)}%`, icon: "alertCircle", tone: kpiTone(overview.hallucinationScore, true) },
        { label: "Est. cost", value: formatCurrency(stats.estimated_cost_usd), hint: `${formatNumber(stats.total_tokens)} tokens`, icon: "zap", tone: "neutral" },
      ]
    : [];

  return (
    <AdminShell
      title="Operations Overview"
      description="Platform health, document readiness, retrieval quality, hallucination risk, agent latency and cost."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">A visual command center for the AI platform.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Icon name="refreshCw" size={15} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {isFetching && !stats ? (
        <LoadingState variant="skeleton" rows={4} skeletonVariant="card" />
      ) : stats && overview ? (
        <div className="grid gap-5">
          <MetricStrip metrics={kpis} />

          {/* Health + pipeline + quality */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-3">
            <DataCard title="Platform health" icon={<Icon name="activity" size={15} />} tone="ai">
              <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                <HealthRing score={overview.healthScore} />
                <div className="grid min-w-0 gap-3">
                  <ScoreMeter label="Indexed documents" value={overview.indexedRatio} />
                  <ScoreMeter label="Embedding coverage" value={overview.embeddingCoverage} />
                  <ScoreMeter label="Faithfulness" value={overview.faithfulness} />
                  <ScoreMeter label="Low hallucination" value={1 - overview.hallucinationScore} />
                  <ScoreMeter label="Agent reliability" value={overview.agentSuccess} />
                </div>
              </div>
            </DataCard>

            <DataCard title="Document pipeline" icon={<Icon name="database" size={15} />}>
              <StackedBar segments={docStatusSegments(stats.documents_by_status)} />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
                <MiniStat label="Total" value={formatNumber(stats.documents.total)} />
                <MiniStat label="Indexed" value={formatNumber(stats.documents.indexed)} tone="success" />
                <MiniStat label="Failed" value={formatNumber(stats.documents.failed)} tone={stats.documents.failed > 0 ? "critical" : "success"} />
              </div>
            </DataCard>

            <DataCard title="RAG quality" icon={<Icon name="shield" size={15} />} actions={<Link href="/admin/quality" className="text-xs font-medium text-brand-fg hover:underline">Details</Link>}>
              <div className="grid gap-3">
                <ScoreMeter label="Faithfulness" value={overview.faithfulness} />
                <ScoreMeter label="Relevance" value={overview.relevance} />
                <ScoreMeter label="Context precision" value={overview.contextPrecision} />
                <ScoreMeter label="Hallucination risk" value={overview.hallucinationScore} invert hint="Lower is safer" />
              </div>
            </DataCard>
          </div>

          {/* Agent latency + LLM cost */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <DataCard title="Agent latency" subtitle="Average per pipeline stage" icon={<Icon name="workflow" size={15} />}>
              {overview.agentRows.length === 0 ? (
                <EmptyState title="No agent telemetry yet" description="Latency appears once RAG queries run." />
              ) : (
                <HBarChart rows={overview.agentRows} />
              )}
            </DataCard>

            <DataCard title="LLM usage & cost" subtitle="Token consumption across the platform" icon={<Icon name="cpu" size={15} />}>
              <div className="grid gap-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-fg-subtle">Estimated cost</p>
                    <p className="text-3xl font-semibold tabular-nums text-fg">{formatCurrency(stats.estimated_cost_usd)}</p>
                  </div>
                  <Badge tone="ai" icon={<Icon name="zap" size={12} />}>{formatNumber(stats.total_tokens)} tokens</Badge>
                </div>
                <StackedBar
                  segments={[
                    { label: "prompt", value: stats.prompt_tokens, tone: "info" },
                    { label: "completion", value: stats.completion_tokens, tone: "ai" },
                  ]}
                />
              </div>
            </DataCard>
          </div>

          {/* Operational watchlists */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-3">
            <DataCard
              title="Risky admin actions"
              icon={<Icon name="shield" size={15} />}
              tone="warning"
              actions={<Link href="/admin/audit-logs" className="text-xs font-medium text-brand-fg hover:underline">Audit log</Link>}
              padded={false}
            >
              {riskyActions.length === 0 ? (
                <div className="p-4"><EmptyState title="All clear" description="No risky admin actions recently." /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {riskyActions.map((log) => (
                    <li key={log.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone="warning" size="sm">{log.action}</Badge>
                          <span className="truncate text-xs text-fg-muted">{log.actor_email ?? "System"}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-fg-subtle">{log.reason ?? `on ${log.target_type}`}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-fg-subtle">{formatDate(log.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DataCard>

            <DataCard
              title="Risky answers"
              icon={<Icon name="alertCircle" size={15} />}
              tone="critical"
              actions={<Link href="/admin/rag-traces" className="text-xs font-medium text-brand-fg hover:underline">Traces</Link>}
              padded={false}
            >
              {riskyAnswers.length === 0 ? (
                <div className="p-4"><EmptyState title="No high-risk answers" description="Hallucination risk is under control." /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {riskyAnswers.map((a) => (
                    <li key={a.message_id} className="min-w-0">
                      <Link href={`/admin/rag-traces/${a.message_id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-fg">{a.question_preview || "—"}</p>
                          <p className="truncate text-[11px] text-fg-subtle">{a.workspace_name}</p>
                        </div>
                        <Badge tone="critical" size="sm">{Math.round(a.hallucination_score * 100)}%</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DataCard>

            <DataCard
              title="Failed documents"
              icon={<Icon name="fileText" size={15} />}
              tone="critical"
              actions={<StatusBadge label={`${failedDocuments.length}`} tone={failedDocuments.length > 0 ? "critical" : "success"} />}
              padded={false}
            >
              {failedDocuments.length === 0 ? (
                <div className="p-4"><EmptyState title="No failed documents" description="Ingestion is healthy." /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {failedDocuments.map((d) => (
                    <li key={d.id} className="min-w-0">
                      <Link href={`/admin/ragops/documents/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-fg">{d.filename}</p>
                          <p className="truncate text-[11px] text-fg-subtle">{d.workspace_name} · {formatDate(d.created_at)}</p>
                        </div>
                        <Icon name="chevronRight" size={15} className="shrink-0 text-fg-subtle" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DataCard>
          </div>
        </div>
      ) : !isFetching && !error ? (
        <EmptyState title="No statistics yet" description="Admin metrics will appear once the platform has activity." />
      ) : null}
    </AdminShell>
  );
}

/* ─── presentational bits ────────────────────────────────────── */
function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: StatusTone }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] uppercase tracking-wide text-fg-subtle">{label}</p>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${barBg[tone]}`} />
        <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      </div>
    </div>
  );
}

/* ─── data shaping ───────────────────────────────────────────── */
function docStatusSegments(statuses: Record<string, number>) {
  const known = STATUS_ORDER.map((s) => ({ label: s, value: statuses[s] ?? 0, tone: STATUS_TONE[s] ?? "neutral" }));
  const extras = Object.entries(statuses)
    .filter(([s]) => !STATUS_ORDER.includes(s))
    .map(([label, value]) => ({ label, value, tone: "neutral" as StatusTone }));
  return [...known, ...extras].filter((s) => s.value > 0);
}

function aggregateRagOps(workspaces: RagOpsWorkspaceSummary[]) {
  const totalChunks = workspaces.reduce((t, i) => t + i.total_chunks, 0);
  const chunksWithVectors = workspaces.reduce((t, i) => t + i.chunks_with_vector_id, 0);
  const failedDocuments = workspaces.reduce((t, i) => t + i.documents_failed, 0);
  return { chunksWithVectors, embeddingCoverage: totalChunks > 0 ? chunksWithVectors / totalChunks : 1, failedDocuments, totalChunks };
}

function buildOverview(
  stats: AdminStats | null,
  quality: RagTraceQualitySummary | null,
  aggregate: ReturnType<typeof aggregateRagOps>,
  errors: AdminErrorSummary[],
) {
  if (!stats) return null;
  const indexedDocuments = stats.documents.indexed ?? 0;
  const indexedRatio = stats.total_documents > 0 ? indexedDocuments / stats.total_documents : 1;
  const faithfulness = quality?.average_faithfulness ?? stats.average_faithfulness ?? 0;
  const relevance = quality?.average_relevance ?? stats.average_relevance ?? 0;
  const contextPrecision = quality?.average_context_precision ?? relevance;
  const hallucinationScore = quality?.average_hallucination_score ?? 0;
  const agentSuccess = Math.max(0, 1 - errors.length / 10);
  const healthScore = Math.round(
    100 * (indexedRatio * 0.3 + aggregate.embeddingCoverage * 0.25 + faithfulness * 0.2 + (1 - hallucinationScore) * 0.15 + agentSuccess * 0.1),
  );
  const latencyRecord =
    Object.keys(stats.agents.avg_latency_ms_by_agent ?? {}).length > 0
      ? stats.agents.avg_latency_ms_by_agent
      : quality?.average_latency_by_agent ?? {};
  const ms = stats.average_latency_ms;
  return {
    agentSuccess,
    agentRows: agentLatencyRows(latencyRecord),
    avgLatencyLabel: ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`,
    contextPrecision,
    embeddingCoverage: aggregate.embeddingCoverage,
    faithfulness,
    hallucinationScore,
    healthScore,
    indexedDocuments,
    indexedRatio,
    relevance,
  };
}
