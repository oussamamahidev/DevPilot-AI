"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/DashboardShell";
import { PersonalDashboard } from "@/features/dashboard/PersonalDashboard";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import {
  getAdminStats,
  getRagOpsQdrantHealth,
  getRagTraceQualitySummary,
  listAdminDocuments,
  listAdminErrors,
  listRagOpsWorkspaces,
  listRagTraces,
} from "@/lib/admin";
import { ApiConnectionError, ApiRequestError, apiGet } from "@/lib/api-client";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import type {
  AdminDocumentSummary,
  AdminErrorSummary,
  AdminStats,
  OperationalHealthResponse,
  OperationalServiceHealth,
  RagOpsQdrantHealth,
  RagOpsWorkspaceSummary,
  RagTraceListItem,
  RagTraceQualitySummary,
} from "@/types";

/* ─── types ──────────────────────────────────────────────────── */
type DashboardData = {
  documents: AdminDocumentSummary[];
  errors: AdminErrorSummary[];
  opsHealth: OperationalHealthResponse | null;
  qdrant: RagOpsQdrantHealth | null;
  quality: RagTraceQualitySummary | null;
  ragOpsWorkspaces: RagOpsWorkspaceSummary[];
  stats: AdminStats;
  traces: RagTraceListItem[];
};
type ChartDatum = Record<string, string | number | null>;

/* ─── chart palette (literal hex — SVG can't read CSS vars) ─── */
const C = {
  violet: "#7C4DFF",
  blue: "#3B82F6",
  teal: "#14B8A6",
  amber: "#F59E0B",
  red: "#EF4444",
  emerald: "#10B981",
  slate: "#64748B",
  grid: "#E2E8F0",
  tick: "#64748B",
} as const;

const docStatusColors: Record<string, string> = {
  indexed: C.emerald,
  processing: C.blue,
  queued: C.amber,
  failed: C.red,
  uploaded: C.teal,
  deleted: C.slate,
};

/* ─── pure helpers (unchanged) ──────────────────────────────── */
function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
const nf = new Intl.NumberFormat("en-US");
const fmtN = (v: number) => nf.format(Math.round(v));
const fmtD = (v: number, d = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
const fmtP = (v: number) => `${fmtD(v * 100, 1)}%`;
function relTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "—";
  }
}
function dayKey(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function dayLabel(k: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(
    new Date(`${k}T00:00:00`),
  );
}
function buildDailyCounts<T>(items: T[], getDate: (i: T) => string | null | undefined, key: string): ChartDatum[] {
  const buckets = new Map<string, number>();
  items.forEach((item) => {
    const k = dayKey(getDate(item));
    if (k) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ date: dayLabel(k), [key]: v }));
}
function buildEvaluationTrend(traces: RagTraceListItem[]): ChartDatum[] {
  const b = new Map<string, { contextPrecision: number; faithfulness: number; hallucination: number; relevance: number; total: number }>();
  traces.forEach((t) => {
    const k = dayKey(t.created_at);
    if (!k) return;
    const c = b.get(k) ?? { contextPrecision: 0, faithfulness: 0, hallucination: 0, relevance: 0, total: 0 };
    c.contextPrecision += t.context_precision;
    c.faithfulness += t.faithfulness;
    c.hallucination += t.hallucination_score;
    c.relevance += t.relevance;
    c.total += 1;
    b.set(k, c);
  });
  return [...b.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({
      date: dayLabel(k),
      faithfulness: v.faithfulness / v.total,
      relevance: v.relevance / v.total,
      contextPrecision: v.contextPrecision / v.total,
      hallucination: v.hallucination / v.total,
    }));
}
function safeRatio(v: number, total: number) { return total > 0 ? v / total : 0; }
function resolveStatus(s: string | null | undefined) {
  if (s === "healthy" || s === "ok") return "healthy";
  if (s === "degraded" || s === "warning") return "degraded";
  return "down";
}
function serviceScore(s: string) {
  const r = resolveStatus(s);
  return r === "healthy" ? 1 : r === "degraded" ? 0.55 : 0;
}
function getOps(ops: OperationalHealthResponse | null, id: string): OperationalServiceHealth | null {
  return ops?.services.find((s) => s.id === id) ?? null;
}

/* ─── page ───────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { isAdmin, isLoading: isAuthLoading, user } = useAdminAccess();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const [stats, documents, traces, quality, errors, ragOpsWorkspaces, qdrant, opsHealth] =
        await Promise.all([
          getAdminStats(),
          listAdminDocuments({ page: 1, page_size: 100 }),
          listRagTraces({ page: 1, page_size: 100 }),
          getRagTraceQualitySummary(),
          listAdminErrors(),
          listRagOpsWorkspaces(),
          getRagOpsQdrantHealth(),
          apiGet<OperationalHealthResponse>("/api/v1/system/ops-health"),
        ]);
      setData({ documents: documents.items, errors: errors.errors, opsHealth, qdrant, quality, ragOpsWorkspaces, stats, traces: traces.items });
      setLastRefreshed(new Date());
    } catch (e) {
      setError(requestErrorMessage(e, "Unable to load dashboard analytics."));
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const analytics = useMemo(() => {
    if (!data) return null;
    const failedDocuments = data.stats.documents_by_status.failed ?? data.stats.documents.failed ?? 0;
    const indexedDocuments = data.stats.documents_by_status.indexed ?? data.stats.documents.indexed ?? 0;
    const activeDocuments = Math.max(0, data.stats.total_documents - (data.stats.documents_by_status.deleted ?? 0));
    const ingestionRatio = safeRatio(indexedDocuments, activeDocuments);
    const criticalWorkspaces = data.ragOpsWorkspaces.filter((w) => w.rag_health_status === "critical").length;
    const qdrantOps = getOps(data.opsHealth, "qdrant");
    const redisOps = getOps(data.opsHealth, "redis");
    const celeryOps = getOps(data.opsHealth, "celery");
    const qdrantHealthy = data.qdrant?.reachable || qdrantOps?.status === "healthy";
    const svcScores = [qdrantOps, redisOps, celeryOps].filter(Boolean) as OperationalServiceHealth[];
    const infraScore = svcScores.length > 0
      ? svcScores.reduce((t, s) => t + serviceScore(s.status), 0) / svcScores.length
      : 0;
    const qualityScore = 1 - (data.quality?.average_hallucination_score ?? 0);
    const platformHealth = Math.round(Math.max(0, Math.min(100, ingestionRatio * 34 + (qdrantHealthy ? 24 : 0) + infraScore * 27 + qualityScore * 15)));
    const docStatusData = Object.entries(data.stats.documents_by_status)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ color: docStatusColors[name] ?? C.slate, name, value }));
    const retrievalSuccess = data.quality
      ? safeRatio(data.quality.total_rag_queries - data.quality.no_context_count, data.quality.total_rag_queries)
      : null;
    const recentActivity = [
      ...data.traces.slice(0, 10).map((t) => ({ id: t.message_id, type: "query" as const, label: t.question_preview || "Query", sub: `faith ${fmtD(t.faithfulness, 2)} · hall ${fmtD(t.hallucination_score, 2)}`, ts: t.created_at, score: t.hallucination_score })),
      ...data.errors.slice(0, 5).map((e) => ({ id: e.id, type: "error" as const, label: e.message, sub: e.source, ts: e.created_at, score: null })),
    ].sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? "")).slice(0, 8);
    return {
      celeryOps, criticalWorkspaces, docStatusData,
      documentsOverTime: buildDailyCounts(data.documents, (d) => d.created_at, "documents"),
      evaluationTrend: buildEvaluationTrend(data.traces),
      failedDocuments, ingestionRatio, platformHealth,
      qdrantOps, redisOps,
      queriesOverTime: buildDailyCounts(data.traces, (t) => t.created_at, "queries"),
      retrievalSuccess, recentActivity,
      worstWorkspaces: [...data.ragOpsWorkspaces].sort((a, b) => a.rag_health_score - b.rag_health_score).slice(0, 4),
    };
  }, [data]);

  if (isAuthLoading) {
    return (
      <DashboardShell activeItem="dashboard" title="Dashboard">
        <LoadingSkeleton label="Loading" rows={6} variant="metric" />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell activeItem="dashboard" title="Dashboard">
        <ErrorState message="Please sign in to view your dashboard." title="Sign in required" />
      </DashboardShell>
    );
  }

  // Standard users get a personal home (workspaces, documents, chat).
  // The admin operations dashboard below is reserved for admin / super admin.
  if (!isAdmin) {
    return <PersonalDashboard />;
  }

  return (
    <DashboardShell activeItem="dashboard" title="Dashboard">
      <div className="grid min-w-0 gap-6">

        {/* ── status bar ──────────────────────────────────────── */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {data?.opsHealth ? (
              <ServicePill status={data.opsHealth.status} label={data.opsHealth.status === "healthy" ? "All systems operational" : `Platform ${data.opsHealth.status}`} />
            ) : null}
            {data ? (
              <div className="flex items-center gap-2">
                {[
                  { id: "qdrant", label: "Qdrant", status: analytics?.qdrantOps?.status ?? (data.qdrant?.reachable ? "healthy" : "down") },
                  { id: "redis", label: "Redis", status: analytics?.redisOps?.status ?? "unknown" },
                  { id: "celery", label: "Celery", status: analytics?.celeryOps?.status ?? "unknown" },
                ].map((svc) => (
                  <span key={svc.id} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${resolveStatus(svc.status) === "healthy" ? "bg-success" : resolveStatus(svc.status) === "degraded" ? "bg-warning" : "bg-danger"}`} />
                    {svc.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshed ? (
              <span className="text-xs text-fg-subtle">Updated {relTime(lastRefreshed.toISOString())}</span>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void loadDashboard()} isLoading={isFetching}>
              <Icon name="activity" size={14} />
              {isFetching ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} title="Unable to load analytics" action={
            <Button variant="secondary" size="sm" onClick={() => void loadDashboard()}>Retry</Button>
          } />
        ) : null}

        {isFetching && !data ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => <LoadingSkeleton key={i} rows={1} variant="metric" />)}
            </div>
            <LoadingSkeleton rows={3} variant="card" />
          </div>
        ) : null}

        {data && analytics ? (
          <>
            {/* ── row 1: 4 hero metric tiles ──────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              <MetricTile
                label="Active Workspaces"
                value={fmtN(data.stats.total_workspaces)}
                sub={analytics.criticalWorkspaces > 0 ? `${analytics.criticalWorkspaces} critical` : "All healthy"}
                subTone={analytics.criticalWorkspaces > 0 ? "danger" : "success"}
                icon="grid"
                href="/admin/ragops"
              />
              <MetricTile
                label="Documents"
                value={fmtN(data.stats.total_documents)}
                sub={`${fmtP(analytics.ingestionRatio)} indexed`}
                subTone={analytics.ingestionRatio >= 0.85 ? "success" : "warning"}
                icon="file"
                href="/admin/documents"
              />
              <MetricTile
                label="RAG Queries"
                value={fmtN(data.quality?.total_rag_queries ?? data.stats.total_rag_queries)}
                sub={`${fmtD(data.stats.average_latency_ms, 0)} ms avg latency`}
                subTone="neutral"
                icon="message"
                href="/admin/rag-traces"
              />
              <MetricTile
                label="Platform Health"
                value={`${analytics.platformHealth}`}
                sub={analytics.platformHealth >= 85 ? "Healthy" : analytics.platformHealth >= 60 ? "Needs attention" : "Critical"}
                subTone={analytics.platformHealth >= 85 ? "success" : analytics.platformHealth >= 60 ? "warning" : "danger"}
                icon="shield"
                gauge={analytics.platformHealth}
              />
            </div>

            {/* ── row 2: AI quality + usage ───────────────────── */}
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <div className="border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-fg">
                    <Icon name="sparkles" size={13} />
                    AI Quality Overview
                  </span>
                </div>
              </div>
              <div className="grid divide-y divide-line sm:divide-x sm:divide-y-0 sm:grid-cols-2 lg:grid-cols-4">
                <QualityGauge
                  label="Faithfulness"
                  value={data.quality?.average_faithfulness ?? data.stats.average_faithfulness ?? null}
                  goodAbove={0.75}
                  lowIsBetter={false}
                />
                <QualityGauge
                  label="Hallucination"
                  value={data.quality?.average_hallucination_score ?? null}
                  goodAbove={0.3}
                  lowIsBetter
                />
                <QualityGauge
                  label="Retrieval Success"
                  value={analytics.retrievalSuccess}
                  goodAbove={0.85}
                  lowIsBetter={false}
                />
                <UsagePanel stats={data.stats} />
              </div>
            </div>

            {/* ── row 3: query activity | doc status ─────────── */}
            <div className="grid min-w-0 gap-4 xl:grid-cols-[1.6fr_1fr]">
              <ChartCard title="Query Activity" description="Daily RAG query volume">
                {analytics.queriesOverTime.length === 0 ? (
                  <EmptyChart title="No query telemetry yet" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.queriesOverTime} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="q-grad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={C.violet} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={C.violet} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fill: C.tick, fontSize: 11 }} width={28} />
                        <Tooltip />
                        <Area dataKey="queries" stroke={C.violet} strokeWidth={2} fill="url(#q-grad)" type="monotone" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Document Status" description="Current ingestion state">
                {analytics.docStatusData.length === 0 ? (
                  <EmptyChart title="No document data" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={analytics.docStatusData} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={52} outerRadius={82} paddingAngle={2}>
                          {analytics.docStatusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>

            {/* ── row 4: evaluation trend | quick actions ─────── */}
            <div className="grid min-w-0 gap-4 xl:grid-cols-[1.6fr_1fr]">
              <ChartCard title="Evaluation Trend" description="Faithfulness, relevance, context precision by day">
                {analytics.evaluationTrend.length === 0 ? (
                  <EmptyChart title="No evaluation telemetry yet" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.evaluationTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} />
                        <YAxis domain={[0, 1]} tick={{ fill: C.tick, fontSize: 11 }} width={28} />
                        <Tooltip formatter={(v) => fmtD(Number(v), 2)} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="faithfulness" stroke={C.emerald} strokeWidth={2} dot={false} />
                        <Line dataKey="relevance" stroke={C.blue} strokeWidth={2} dot={false} />
                        <Line dataKey="contextPrecision" stroke={C.violet} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-fg">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { href: "/chat", icon: "message" as const, label: "New Chat", sub: "Ask your documents" },
                    { href: "/documents", icon: "file" as const, label: "Upload", sub: "Add documents" },
                    { href: "/admin/rag-traces", icon: "activity" as const, label: "Traces", sub: "Inspect queries" },
                    { href: "/admin/ragops", icon: "layers" as const, label: "RAGOps", sub: "Platform health" },
                  ].map((action) => (
                    <Link key={action.href} href={action.href}
                      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 transition hover:bg-hover hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-subtle text-brand-fg">
                        <Icon name={action.icon} size={16} />
                      </span>
                      <span className="text-sm font-semibold text-fg">{action.label}</span>
                      <span className="text-xs text-fg-subtle">{action.sub}</span>
                    </Link>
                  ))}
                </div>

                {analytics.failedDocuments > 0 ? (
                  <Link href="/admin/documents?status=failed"
                    className="flex items-center gap-2.5 rounded-xl border border-danger-line bg-danger-subtle px-3.5 py-3 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    <Icon name="alertCircle" size={16} className="text-danger-fg shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-danger-surface-fg">{fmtN(analytics.failedDocuments)} failed documents</p>
                      <p className="text-xs text-danger-fg">Review and retry →</p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-success-line bg-success-subtle px-3.5 py-3">
                    <Icon name="checkCircle" size={16} className="text-success-fg shrink-0" />
                    <p className="text-sm font-medium text-success-surface-fg">No ingestion failures</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── row 5: recent activity | workspace health ────── */}
            <div className="grid min-w-0 gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-line bg-surface shadow-sm">
                <div className="border-b border-line px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-fg">Recent Activity</p>
                  <p className="text-xs text-fg-muted">Latest queries and platform events</p>
                </div>
                {analytics.recentActivity.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="No recent activity" description="Activity appears once queries have run." />
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {analytics.recentActivity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.type === "error" ? "bg-danger-subtle text-danger-fg" : "bg-brand-subtle text-brand-fg"}`}>
                          <Icon name={item.type === "error" ? "alertCircle" : "message"} size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-fg">{item.label}</p>
                          <p className="text-xs text-fg-subtle">{item.sub}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-fg-subtle">{relTime(item.ts)}</p>
                          {item.type === "query" && item.score != null ? (
                            <Badge tone={item.score > 0.6 ? "critical" : item.score > 0.3 ? "warning" : "success"} className="mt-1 text-[10px]">
                              hall {fmtD(item.score, 2)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {data.traces.length > 0 ? (
                  <div className="border-t border-line px-4 py-2.5 sm:px-5">
                    <Link href="/admin/rag-traces" className="text-xs font-medium text-brand-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                      View all traces →
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-line bg-surface shadow-sm">
                <div className="border-b border-line px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-fg">Workspace Health</p>
                  <p className="text-xs text-fg-muted">Worst-performing first</p>
                </div>
                {analytics.worstWorkspaces.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="No workspaces" description="Workspace health appears after indexing." />
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {analytics.worstWorkspaces.map((ws) => {
                      const score = Math.round(ws.rag_health_score);
                      const barCls = score >= 85 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-danger";
                      return (
                        <Link key={ws.workspace_id} href={`/admin/ragops/workspaces/${ws.workspace_id}`}
                          className="flex items-center gap-3 px-4 py-3 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">{ws.workspace_name}</p>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                              <div className={`h-full rounded-full ${barCls}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">{score}</span>
                          <Icon name="chevronRight" size={14} className="shrink-0 text-fg-subtle" />
                        </Link>
                      );
                    })}
                  </div>
                )}
                <div className="border-t border-line px-4 py-2.5 sm:px-5">
                  <Link href="/admin/ragops" className="text-xs font-medium text-brand-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    View RAGOps →
                  </Link>
                </div>
              </div>
            </div>

            {/* ── row 6: infrastructure ───────────────────────── */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-fg">Infrastructure</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <InfraCard
                  label="Qdrant"
                  icon="box"
                  status={analytics.qdrantOps?.status ?? (data.qdrant?.reachable ? "healthy" : "down")}
                  primary={data.qdrant?.qdrant_vectors_count != null ? `${fmtN(data.qdrant.qdrant_vectors_count)} vectors` : "Vectors unknown"}
                  detail={analytics.qdrantOps?.detail ?? (data.qdrant?.reachable ? "Reachable" : "Unreachable")}
                />
                <InfraCard
                  label="Redis"
                  icon="activity"
                  status={analytics.redisOps?.status ?? "unknown"}
                  primary={analytics.redisOps?.latency_ms != null ? `${fmtD(analytics.redisOps.latency_ms, 1)} ms` : "Latency unknown"}
                  detail={analytics.redisOps?.detail ?? "No data"}
                />
                <InfraCard
                  label="Celery"
                  icon="layers"
                  status={analytics.celeryOps?.status ?? "unknown"}
                  primary={typeof analytics.celeryOps?.metadata.workers === "number" ? `${analytics.celeryOps.metadata.workers} workers` : "Workers unknown"}
                  detail={analytics.celeryOps?.detail ?? "No data"}
                />
                <InfraCard
                  label="Ingestion"
                  icon="file"
                  status={analytics.failedDocuments > 0 || analytics.criticalWorkspaces > 0 ? "degraded" : "healthy"}
                  primary={`${fmtP(analytics.ingestionRatio)} indexed`}
                  detail={analytics.failedDocuments > 0 ? `${fmtN(analytics.failedDocuments)} failed` : "No failures"}
                />
              </div>
            </div>
          </>
        ) : !isFetching && !error ? (
          <EmptyState title="No analytics available" description="The backend returned no dashboard data." />
        ) : null}
      </div>
    </DashboardShell>
  );
}

/* ─── local components ───────────────────────────────────────── */

function MetricTile({
  gauge,
  href,
  icon,
  label,
  sub,
  subTone,
  value,
}: {
  gauge?: number;
  href?: string;
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  sub: string;
  subTone: "success" | "warning" | "danger" | "neutral";
  value: string;
}) {
  const subColor = {
    success: "text-success-fg",
    warning: "text-warning-fg",
    danger: "text-danger-fg",
    neutral: "text-fg-subtle",
  }[subTone];

  const content = (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-line-strong">
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sunken text-fg-muted">
          <Icon name={icon} size={16} />
        </span>
        {gauge != null ? (
          <SmallGauge value={gauge} />
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-fg">{value}</p>
      <p className="mt-1 text-xs font-medium text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-xs font-medium ${subColor}`}>{sub}</p>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block h-full min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xl">
      {content}
    </Link>
  );
}

function SmallGauge({ value }: { value: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circ * (1 - pct / 100);
  const color = pct >= 85 ? C.emerald : pct >= 60 ? C.amber : C.red;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#E2E8F0" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
    </svg>
  );
}

function QualityGauge({
  goodAbove,
  label,
  lowIsBetter,
  value,
}: {
  goodAbove: number;
  label: string;
  lowIsBetter: boolean;
  value: number | null;
}) {
  const pct = value != null ? Math.round(value * 100) : null;
  const good = value != null ? (lowIsBetter ? value <= goodAbove : value >= goodAbove) : null;
  const tone = good === null ? "text-fg-subtle" : good ? "text-success-fg" : value! > (lowIsBetter ? goodAbove * 1.6 : goodAbove * 0.67) ? "text-danger-fg" : "text-warning-fg";
  const barColor = good === null ? "#64748B" : good ? C.emerald : C.amber;
  const barPct = pct ?? 0;

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
      <p className="text-xs font-medium text-fg-subtle">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${tone}`}>
        {value != null ? value.toFixed(2) : "—"}
      </p>
      {pct != null ? (
        <div className="w-full max-w-24">
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
          </div>
        </div>
      ) : null}
      <p className="text-[10px] uppercase tracking-wide text-fg-subtle">
        {lowIsBetter ? "lower is better" : `target ≥ ${goodAbove}`}
      </p>
    </div>
  );
}

function UsagePanel({ stats }: { stats: AdminStats }) {
  return (
    <div className="flex flex-col justify-center gap-4 px-4 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Usage</p>
      <div className="grid gap-3">
        {[
          { label: "Prompt tokens", value: fmtN(stats.prompt_tokens) },
          { label: "Completion tokens", value: fmtN(stats.completion_tokens) },
          { label: "Est. cost", value: `$${fmtD(stats.estimated_cost_usd, 4)}` },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-fg-muted">{row.label}</span>
            <span className="text-sm font-semibold tabular-nums text-fg">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      <div className="mt-4 min-w-0">{children}</div>
    </div>
  );
}

function EmptyChart({ title }: { title: string }) {
  return (
    <div className="grid h-56 place-items-center rounded-lg border border-dashed border-line bg-sunken p-4 text-center">
      <div>
        <p className="text-sm text-fg-muted">{title}</p>
        <p className="mt-1 text-xs text-fg-subtle">Charts appear once the API returns records.</p>
      </div>
    </div>
  );
}

function InfraCard({
  detail,
  icon,
  label,
  primary,
  status,
}: {
  detail: string;
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  primary: string;
  status: string;
}) {
  const resolved = resolveStatus(status);
  const borderCls = resolved === "healthy" ? "border-success-line" : resolved === "degraded" ? "border-warning-line" : "border-line";
  const dotCls = resolved === "healthy" ? "bg-success" : resolved === "degraded" ? "bg-warning" : "bg-danger";
  return (
    <div className={`rounded-xl border bg-surface p-4 shadow-sm ${borderCls}`}>
      <div className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sunken text-fg-muted">
          <Icon name={icon} size={16} />
        </span>
        <span className={`h-2 w-2 rounded-full ${dotCls}`} />
      </div>
      <p className="mt-3 text-sm font-semibold text-fg">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{primary}</p>
      <p className="mt-1 truncate text-xs text-fg-subtle">{detail}</p>
    </div>
  );
}

function ServicePill({ label, status }: { label: string; status: string }) {
  const resolved = resolveStatus(status);
  const cls = resolved === "healthy"
    ? "border-success-line bg-success-subtle text-success-surface-fg"
    : resolved === "degraded"
      ? "border-warning-line bg-warning-subtle text-warning-surface-fg"
      : "border-danger-line bg-danger-subtle text-danger-surface-fg";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${resolved === "healthy" ? "bg-success" : resolved === "degraded" ? "bg-warning" : "bg-danger"}`} />
      {label}
    </span>
  );
}
