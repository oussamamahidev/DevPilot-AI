"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui";
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

const chartColors = {
  amber: "#F59E0B",
  blue: "#3B82F6",
  cyan: "#06B6D4",
  emerald: "#10B981",
  red: "#EF4444",
  slate: "#64748B",
  violet: "#7C4DFF",
} as const;

const documentStatusColors: Record<string, string> = {
  deleted: chartColors.slate,
  failed: chartColors.red,
  indexed: chartColors.emerald,
  processing: chartColors.blue,
  queued: chartColors.amber,
  uploaded: chartColors.cyan,
};

const serviceToneClasses: Record<string, string> = {
  degraded: "border-warning-line bg-warning-subtle text-warning-surface-fg",
  down: "border-danger-line bg-danger-subtle text-danger-surface-fg",
  healthy: "border-success-line bg-success-subtle text-success-surface-fg",
};

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number) {
  return `${formatDecimal(value * 100, 1)}%`;
}

function dayKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${key}T00:00:00`));
}

function buildDailyCounts<TItem>(
  items: TItem[],
  getDate: (item: TItem) => string | null | undefined,
  keyName: string,
) {
  const buckets = new Map<string, number>();
  items.forEach((item) => {
    const key = dayKey(getDate(item));
    if (!key) {
      return;
    }
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ date: dayLabel(key), [keyName]: value }));
}

function buildEvaluationTrend(traces: RagTraceListItem[]) {
  const buckets = new Map<
    string,
    {
      contextPrecision: number;
      faithfulness: number;
      hallucination: number;
      relevance: number;
      total: number;
    }
  >();
  traces.forEach((trace) => {
    const key = dayKey(trace.created_at);
    if (!key) {
      return;
    }
    const current = buckets.get(key) ?? {
      contextPrecision: 0,
      faithfulness: 0,
      hallucination: 0,
      relevance: 0,
      total: 0,
    };
    current.contextPrecision += trace.context_precision;
    current.faithfulness += trace.faithfulness;
    current.hallucination += trace.hallucination_score;
    current.relevance += trace.relevance;
    current.total += 1;
    buckets.set(key, current);
  });
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      contextPrecision: value.contextPrecision / value.total,
      date: dayLabel(key),
      faithfulness: value.faithfulness / value.total,
      hallucination: value.hallucination / value.total,
      relevance: value.relevance / value.total,
    }));
}

function safeRatio(value: number, total: number) {
  return total > 0 ? value / total : 0;
}

function resolveServiceStatus(statusValue: string | null | undefined) {
  if (statusValue === "healthy" || statusValue === "ok") {
    return "healthy";
  }
  if (statusValue === "degraded" || statusValue === "warning") {
    return "degraded";
  }
  return "down";
}

function serviceScore(statusValue: string) {
  const status = resolveServiceStatus(statusValue);
  if (status === "healthy") {
    return 1;
  }
  if (status === "degraded") {
    return 0.55;
  }
  return 0;
}

function getOpsService(opsHealth: OperationalHealthResponse | null, serviceId: string) {
  return opsHealth?.services.find((service) => service.id === serviceId) ?? null;
}

export default function DashboardPage() {
  const { isAdmin, isLoading: isAuthLoading, user } = useAdminAccess();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const [
        stats,
        documents,
        traces,
        quality,
        errors,
        ragOpsWorkspaces,
        qdrant,
        opsHealth,
      ] = await Promise.all([
        getAdminStats(),
        listAdminDocuments({ page: 1, page_size: 100 }),
        listRagTraces({ page: 1, page_size: 100 }),
        getRagTraceQualitySummary(),
        listAdminErrors(),
        listRagOpsWorkspaces(),
        getRagOpsQdrantHealth(),
        apiGet<OperationalHealthResponse>("/api/v1/system/ops-health"),
      ]);
      setData({
        documents: documents.items,
        errors: errors.errors,
        opsHealth,
        qdrant,
        quality,
        ragOpsWorkspaces,
        stats,
        traces: traces.items,
      });
    } catch (requestError) {
      setError(requestErrorMessage(requestError, "Unable to load dashboard analytics."));
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const analytics = useMemo(() => {
    if (!data) {
      return null;
    }

    const failedDocuments = data.stats.documents_by_status.failed ?? data.stats.documents.failed ?? 0;
    const failedJobs = failedDocuments + data.errors.length;
    const indexedDocuments =
      data.stats.documents_by_status.indexed ?? data.stats.documents.indexed ?? 0;
    const activeDocuments = Math.max(
      0,
      data.stats.total_documents - (data.stats.documents_by_status.deleted ?? 0),
    );
    const ingestionRatio = safeRatio(indexedDocuments, activeDocuments);
    const criticalWorkspaces = data.ragOpsWorkspaces.filter(
      (workspace) => workspace.rag_health_status === "critical",
    ).length;
    const qdrantOps = getOpsService(data.opsHealth, "qdrant");
    const redisOps = getOpsService(data.opsHealth, "redis");
    const celeryOps = getOpsService(data.opsHealth, "celery");
    const qdrantHealthy = data.qdrant?.reachable || qdrantOps?.status === "healthy";
    const serviceScores = [qdrantOps, redisOps, celeryOps].filter(
      (service): service is OperationalServiceHealth => Boolean(service),
    );
    const infraScore =
      serviceScores.length > 0
        ? serviceScores.reduce((total, service) => total + serviceScore(service.status), 0) /
          serviceScores.length
        : 0;
    const qualityScore = 1 - (data.quality?.average_hallucination_score ?? 0);
    const platformHealth = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          ingestionRatio * 34 + (qdrantHealthy ? 24 : 0) + infraScore * 27 + qualityScore * 15,
        ),
      ),
    );
    const documentStatusData = Object.entries(data.stats.documents_by_status)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        color: documentStatusColors[name] ?? chartColors.slate,
        name,
        value,
      }));

    return {
      celeryOps,
      criticalWorkspaces,
      documentStatusData,
      documentsOverTime: buildDailyCounts(data.documents, (document) => document.created_at, "documents"),
      evaluationTrend: buildEvaluationTrend(data.traces),
      failedDocuments,
      failedJobs,
      ingestionRatio,
      platformHealth,
      qdrantOps,
      queriesOverTime: buildDailyCounts(data.traces, (trace) => trace.created_at, "queries"),
      redisOps,
    };
  }, [data]);

  if (isAuthLoading) {
    return (
      <DashboardShell activeItem="dashboard" title="Dashboard" description="Loading analytics.">
        <LoadingSkeleton label="Loading dashboard" rows={6} />
      </DashboardShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <DashboardShell
        activeItem="dashboard"
        title="Dashboard"
        description="Platform analytics require admin access."
      >
        <ErrorState
          message="This operational dashboard is available to admin and super admin accounts."
          title="Admin access required"
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="dashboard"
      title="Dashboard"
      description="Operational analytics, RAG quality, ingestion health, and infrastructure readiness."
    >
      <div className="grid min-w-0 gap-6">
        <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <div className="border-b border-line bg-surface px-4 py-5 text-fg sm:px-5">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-fg">
                  DevPilot AI Operations
                </p>
                <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal sm:text-3xl">
                  Platform analytics console
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-fg-muted">
                  Live usage, document ingestion, answer quality, and runtime health from backend APIs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {data?.opsHealth ? (
                  <StatusPill status={data.opsHealth.status}>
                    {data.opsHealth.status}
                  </StatusPill>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void loadDashboard()}
                  isLoading={isFetching}
                  variant="secondary"
                >
                  {isFetching ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-4 sm:p-5">
              <ErrorState
                action={
                  <Button type="button" variant="secondary" onClick={() => void loadDashboard()}>
                    Retry
                  </Button>
                }
                message={error}
                title="Unable to load analytics"
              />
            </div>
          ) : null}
        </section>

        {isFetching && !data ? <LoadingSkeleton label="Loading analytics" rows={8} /> : null}

        {data && analytics ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Active users"
                value={formatNumber(data.stats.active_users)}
                detail={`${formatNumber(data.stats.total_users)} total accounts`}
                tone="blue"
              />
              <KpiCard
                label="Workspaces"
                value={formatNumber(data.stats.total_workspaces)}
                detail={`${formatNumber(analytics.criticalWorkspaces)} critical RAG spaces`}
                tone={analytics.criticalWorkspaces > 0 ? "amber" : "emerald"}
              />
              <KpiCard
                label="Documents"
                value={formatNumber(data.stats.total_documents)}
                detail={`${formatPercent(analytics.ingestionRatio)} indexed`}
                tone="violet"
              />
              <KpiCard
                label="RAG queries"
                value={formatNumber(data.quality?.total_rag_queries ?? data.stats.total_rag_queries)}
                detail={`${formatDecimal(data.stats.average_latency_ms, 0)} ms average latency`}
                tone="cyan"
              />
              <KpiCard
                label="Failed jobs"
                value={formatNumber(analytics.failedJobs)}
                detail={`${formatNumber(analytics.failedDocuments)} failed documents`}
                tone={analytics.failedJobs > 0 ? "red" : "emerald"}
              />
            </section>

            <section className="grid min-w-0 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <ChartPanel
                title="Queries over time"
                description="Daily RAG query volume from trace records."
              >
                <AreaChartBlock
                  data={analytics.queriesOverTime}
                  dataKey="queries"
                  color={chartColors.blue}
                  emptyTitle="No query telemetry"
                />
              </ChartPanel>

              <ChartPanel
                title="Document status"
                description="Current ingestion state across all documents."
              >
                <PieChartBlock data={analytics.documentStatusData} />
              </ChartPanel>
            </section>

            <section className="grid min-w-0 gap-6 xl:grid-cols-2">
              <ChartPanel
                title="Documents uploaded over time"
                description="Daily document intake from admin document records."
              >
                <BarChartBlock
                  data={analytics.documentsOverTime}
                  dataKey="documents"
                  color={chartColors.violet}
                  emptyTitle="No document upload telemetry"
                />
              </ChartPanel>

              <ChartPanel
                title="Evaluation scores trend"
                description="Faithfulness, relevance, and context precision averaged by day."
              >
                <EvaluationLineChart data={analytics.evaluationTrend} />
              </ChartPanel>
            </section>

            <section className="grid min-w-0 gap-6 xl:grid-cols-[1fr_420px]">
              <ChartPanel
                title="Hallucination trend"
                description="Average hallucination score by day. Lower is better."
              >
                <HallucinationTrendChart data={analytics.evaluationTrend} />
              </ChartPanel>

              <ChartPanel
                title="Platform health"
                description="Composite score from ingestion, Qdrant, Redis, Celery, and answer safety."
              >
                <RadialHealthChart value={analytics.platformHealth} />
              </ChartPanel>
            </section>

            <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HealthCard
                label="Ingestion health"
                status={
                  analytics.failedDocuments > 0 || analytics.criticalWorkspaces > 0
                    ? "degraded"
                    : "healthy"
                }
                detail={
                  analytics.failedDocuments > 0
                    ? `${formatNumber(analytics.failedDocuments)} documents failed ingestion.`
                    : "No failed ingestion jobs in current API summary."
                }
                metric={`${formatPercent(analytics.ingestionRatio)} indexed`}
              />
              <HealthCard
                label="Qdrant health"
                status={
                  analytics.qdrantOps
                    ? analytics.qdrantOps.status
                    : data.qdrant?.reachable
                      ? "healthy"
                      : "down"
                }
                detail={
                  analytics.qdrantOps?.detail ??
                  (data.qdrant?.reachable ? "Qdrant reachable." : "Qdrant unreachable.")
                }
                metric={
                  data.qdrant?.qdrant_vectors_count === null ||
                  data.qdrant?.qdrant_vectors_count === undefined
                    ? "Vectors unknown"
                    : `${formatNumber(data.qdrant.qdrant_vectors_count)} vectors`
                }
              />
              <HealthCard
                label="Celery health"
                status={analytics.celeryOps?.status ?? "down"}
                detail={analytics.celeryOps?.detail ?? "Celery health data unavailable."}
                metric={
                  typeof analytics.celeryOps?.metadata.workers === "number"
                    ? `${analytics.celeryOps.metadata.workers} workers`
                    : "Workers unknown"
                }
              />
              <HealthCard
                label="Redis health"
                status={analytics.redisOps?.status ?? "down"}
                detail={analytics.redisOps?.detail ?? "Redis health data unavailable."}
                metric={
                  analytics.redisOps?.latency_ms === null ||
                  analytics.redisOps?.latency_ms === undefined
                    ? "Latency unknown"
                    : `${formatDecimal(analytics.redisOps.latency_ms, 1)} ms`
                }
              />
            </section>
          </>
        ) : !isFetching && !error ? (
          <EmptyState
            title="No analytics available"
            description="The backend returned no dashboard data for the current admin account."
          />
        ) : null}
      </div>
    </DashboardShell>
  );
}

function KpiCard({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "amber" | "blue" | "cyan" | "emerald" | "red" | "violet";
  value: string;
}) {
  const toneClasses = {
    amber: "border-warning-line bg-warning-subtle text-warning-surface-fg",
    blue: "border-info-line bg-info-subtle text-info-surface-fg",
    cyan: "border-info-line bg-info-subtle text-info-surface-fg",
    emerald: "border-success-line bg-success-subtle text-success-surface-fg",
    red: "border-danger-line bg-danger-subtle text-danger-surface-fg",
    violet: "border-brand-subtle-line bg-brand-subtle text-brand-fg",
  }[tone];

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="break-words text-sm font-medium text-fg-subtle">{label}</p>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${toneClasses}`} />
      </div>
      <p className="mt-3 break-words text-3xl font-semibold tracking-normal text-fg">
        {value}
      </p>
      <p className="mt-2 break-words text-sm leading-5 text-fg-muted">{detail}</p>
    </section>
  );
}

function ChartPanel({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="min-w-0">
        <h2 className="break-words text-base font-semibold text-fg">{title}</h2>
        <p className="mt-1 break-words text-sm leading-6 text-fg-muted">{description}</p>
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

function EmptyChart({ title }: { title: string }) {
  return (
    <div className="grid h-72 place-items-center rounded-md border border-dashed border-line-strong bg-sunken p-4 text-center">
      <div>
        <p className="text-sm font-medium text-fg-muted">{title}</p>
        <p className="mt-1 text-xs text-fg-subtle">Charts appear when the API returns records.</p>
      </div>
    </div>
  );
}

function AreaChartBlock({
  color,
  data,
  dataKey,
  emptyTitle,
}: {
  color: string;
  data: ChartDatum[];
  dataKey: string;
  emptyTitle: string;
}) {
  if (data.length === 0) {
    return <EmptyChart title={emptyTitle} />;
  }
  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
          <defs>
            <linearGradient id={`${dataKey}-gradient`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip />
          <Area
            dataKey={dataKey}
            fill={`url(#${dataKey}-gradient)`}
            stroke={color}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarChartBlock({
  color,
  data,
  dataKey,
  emptyTitle,
}: {
  color: string;
  data: ChartDatum[];
  dataKey: string;
  emptyTitle: string;
}) {
  if (data.length === 0) {
    return <EmptyChart title={emptyTitle} />;
  }
  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvaluationLineChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart title="No evaluation telemetry" />;
  }
  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip formatter={(value) => formatDecimal(Number(value), 2)} />
          <Legend />
          <Line dataKey="faithfulness" dot={false} stroke={chartColors.emerald} strokeWidth={2} />
          <Line dataKey="relevance" dot={false} stroke={chartColors.blue} strokeWidth={2} />
          <Line dataKey="contextPrecision" dot={false} stroke={chartColors.violet} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HallucinationTrendChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart title="No hallucination telemetry" />;
  }
  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip formatter={(value) => formatDecimal(Number(value), 2)} />
          <Line
            dataKey="hallucination"
            dot={{ r: 3 }}
            stroke={chartColors.red}
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartBlock({
  data,
}: {
  data: { color: string; name: string; value: number }[];
}) {
  if (data.length === 0) {
    return <EmptyChart title="No document status telemetry" />;
  }
  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="48%"
            data={data}
            dataKey="value"
            innerRadius={58}
            nameKey="name"
            outerRadius={92}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadialHealthChart({ value }: { value: number }) {
  const color = value >= 85 ? chartColors.emerald : value >= 60 ? chartColors.amber : chartColors.red;
  return (
    <div className="relative grid h-72 min-w-0 place-items-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          data={[{ name: "Health", value, fill: color }]}
          endAngle={-270}
          innerRadius="68%"
          outerRadius="92%"
          startAngle={90}
        >
          <PolarAngleAxis domain={[0, 100]} tick={false} type="number" />
          <RadialBar background={{ fill: "#E2E8F0" }} dataKey="value" cornerRadius={12} />
          <Tooltip formatter={(tooltipValue) => `${formatDecimal(Number(tooltipValue), 0)}%`} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute text-center">
        <p className="text-4xl font-semibold text-fg">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase text-fg-subtle">health score</p>
      </div>
    </div>
  );
}

function HealthCard({
  detail,
  label,
  metric,
  status,
}: {
  detail: string;
  label: string;
  metric: string;
  status: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-sm font-semibold text-fg">{label}</h2>
          <p className="mt-2 break-words text-sm leading-5 text-fg-muted">{detail}</p>
        </div>
        <StatusPill status={status}>{resolveServiceStatus(status)}</StatusPill>
      </div>
      <p className="mt-5 break-words text-xl font-semibold text-fg">{metric}</p>
    </section>
  );
}

function StatusPill({
  children,
  status,
}: {
  children: ReactNode;
  status: string;
}) {
  const resolved = resolveServiceStatus(status);
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center overflow-hidden rounded-md border px-2 py-1 text-xs font-medium capitalize ${
        serviceToneClasses[resolved] ?? serviceToneClasses.down
      }`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
