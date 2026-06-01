"use client";

/**
 * @deprecated LEGACY GRAB-BAG — do not add to this file or import from it in new code.
 *
 * Most exports here duplicate canonical design-system primitives:
 *   PageHeader, StatusBadge, LoadingSkeleton, EmptyState, StatCard, ProgressRing,
 *   PipelineStepper, DataTable, FilterBar, CitationCard, AgentTimeline.
 * Replace them with `@/components/ui` (PageHeader, StatusBadge, LoadingState,
 * EmptyState, MetricCard, DataCard, DataTable) and the feature chart modules.
 * The Recharts-based charts are being superseded by lightweight tokenized
 * visualisations. Migration tracked in MIGRATION.md.
 */

import Link from "next/link";
import type { ReactNode } from "react";
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
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  RagOpsPipelineStage,
  RagTraceAgentRun,
  RagTraceCitation,
  RagTraceRerankingItem,
} from "@/types";
import { formatDate, formatDecimal, formatNumber } from "@/components/admin/AdminUI";

export type Tone = "success" | "warning" | "critical" | "info" | "ai" | "neutral";

export type ChartDatum = Record<string, string | number | null | undefined>;

export const chartPalette = {
  ai: "#7C4DFF",
  amber: "#F59E0B",
  blue: "#3B82F6",
  cyan: "#06B6D4",
  emerald: "#10B981",
  red: "#EF4444",
  slate: "#64748B",
  sky: "#0EA5E9",
};

export const statusColorMap: Record<string, string> = {
  completed: chartPalette.emerald,
  critical: chartPalette.red,
  deleted: chartPalette.slate,
  failed: chartPalette.red,
  healthy: chartPalette.emerald,
  indexed: chartPalette.emerald,
  pending: "#64748B",
  processing: chartPalette.blue,
  queued: chartPalette.amber,
  success: chartPalette.emerald,
  uploaded: chartPalette.blue,
  warning: chartPalette.amber,
};

const toneClasses: Record<Tone, string> = {
  ai: "border-brand-subtle-line bg-brand-subtle text-brand-fg",
  critical: "border-danger-line bg-danger-subtle text-danger-surface-fg",
  info: "border-info-line bg-info-subtle text-info-surface-fg",
  neutral: "border-line bg-sunken text-fg-muted",
  success: "border-success-line bg-success-subtle text-success-surface-fg",
  warning: "border-warning-line bg-warning-subtle text-warning-surface-fg",
};

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function getHealthColor(score: number) {
  if (score >= 85) {
    return chartPalette.emerald;
  }
  if (score >= 60) {
    return chartPalette.amber;
  }
  return chartPalette.red;
}

export function getHealthStatus(score: number) {
  if (score >= 85) {
    return "Healthy";
  }
  if (score >= 60) {
    return "Warning";
  }
  return "Critical";
}

export function getStatusColor(status: string | null | undefined) {
  if (!status) {
    return statusColorMap.pending;
  }
  return statusColorMap[status.toLowerCase()] ?? chartPalette.slate;
}

export function getStatusTone(status: string | null | undefined): Tone {
  const normalized = status?.toLowerCase() ?? "";
  if (["healthy", "success", "completed", "indexed", "active"].includes(normalized)) {
    return "success";
  }
  if (["warning", "queued", "pending", "uploaded", "processing"].includes(normalized)) {
    return normalized === "processing" ? "info" : "warning";
  }
  if (["critical", "failed", "error", "deleted", "inactive"].includes(normalized)) {
    return "critical";
  }
  return "neutral";
}

export function getHallucinationRisk(score: number) {
  if (score <= 0.3) {
    return { label: "Low risk", tone: "success" as Tone, color: chartPalette.emerald };
  }
  if (score <= 0.6) {
    return { label: "Medium risk", tone: "warning" as Tone, color: chartPalette.amber };
  }
  return { label: "High risk", tone: "critical" as Tone, color: chartPalette.red };
}

export function getQualityTone(value: number, inverted = false): Tone {
  if (inverted) {
    if (value <= 0.3) {
      return "success";
    }
    if (value <= 0.6) {
      return "warning";
    }
    return "critical";
  }
  if (value >= 0.75) {
    return "success";
  }
  if (value >= 0.5) {
    return "warning";
  }
  return "critical";
}

export function formatPercent(value: number, digits = 1) {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${formatDecimal(percent, digits)}%`;
}

export function formatLatency(ms: number | null | undefined) {
  if (ms === null || ms === undefined) {
    return "Unknown";
  }
  if (ms < 1000) {
    return `${formatNumber(Math.round(ms))} ms`;
  }
  return `${formatDecimal(ms / 1000, 2)} s`;
}

export function shortenId(id: string | null | undefined, size = 8) {
  if (!id) {
    return "unknown";
  }
  if (id.length <= size * 2 + 3) {
    return id;
  }
  return `${id.slice(0, size)}...${id.slice(-size)}`;
}

export function safePreview(text: string | null | undefined, maxLength = 180) {
  if (!text) {
    return "Not recorded";
  }
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function computeWorkspaceHealthScore(input: {
  rag_health_score?: number;
  documents_failed: number;
  documents_indexed: number;
  documents_total: number;
  embedding_coverage_percent: number;
}) {
  if (typeof input.rag_health_score === "number") {
    return input.rag_health_score;
  }
  const indexedRatio =
    input.documents_total > 0 ? input.documents_indexed / input.documents_total : 1;
  const failedRatio =
    input.documents_total > 0 ? input.documents_failed / input.documents_total : 0;
  const embeddingRatio = clamp(input.embedding_coverage_percent, 0, 100) / 100;
  return Math.round(clamp(indexedRatio * 40 + embeddingRatio * 45 + (1 - failedRatio) * 15));
}

export function sanitizeDebugJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDebugJson(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const sanitized: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (/token|secret|password|api[_-]?key|authorization|jwt|credential/i.test(key)) {
      sanitized[key] = "[redacted]";
      return;
    }
    sanitized[key] = sanitizeDebugJson(item);
  });
  return sanitized;
}

export function PageHeader({
  actions,
  eyebrow = "DevPilot AI Control Center",
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="mb-6 min-w-0 overflow-hidden rounded-lg border border-line bg-surface px-4 py-5 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-fg">
            {eyebrow}
          </p>
          <h2 className="mt-2 break-words text-xl font-semibold tracking-normal text-fg sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-fg-muted">{subtitle}</p>
        </div>
        {actions ? <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">{actions}</div> : null}
      </div>
    </section>
  );
}

export function RefreshButton({
  isFetching,
  onClick,
}: {
  isFetching: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching}
      className="h-10 max-w-full rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-fg-muted shadow-sm hover:bg-hover disabled:cursor-not-allowed disabled:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      {isFetching ? "Refreshing..." : "Refresh"}
    </button>
  );
}

export function StatusBadge({
  label,
  status,
  tone,
}: {
  label?: string;
  status?: string | null;
  tone?: Tone;
}) {
  const resolvedTone = tone ?? getStatusTone(status);
  return (
    <span
      className={`inline-flex max-w-full items-center overflow-hidden rounded-md border px-2 py-1 text-xs font-medium capitalize ${toneClasses[resolvedTone]}`}
    >
      <span className="truncate">{label ?? status ?? "unknown"}</span>
    </span>
  );
}

export function QualityBadge({
  inverted = false,
  label,
  value,
}: {
  inverted?: boolean;
  label: string;
  value: number;
}) {
  return (
    <StatusBadge
      label={`${label} ${formatDecimal(value, 2)}`}
      tone={getQualityTone(value, inverted)}
    />
  );
}

export function RiskBadge({ value }: { value: number }) {
  const risk = getHallucinationRisk(value);
  return <StatusBadge label={`${risk.label} ${formatDecimal(value, 2)}`} tone={risk.tone} />;
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-lg border border-line bg-sunken"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  action,
  label,
}: {
  action?: ReactNode;
  label: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-line-strong bg-sunken p-6 text-center">
      <p className="text-sm font-medium text-fg-muted">{label}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function ErrorCard({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry?: () => void;
}) {
  if (!message) {
    return null;
  }
  return (
    <section className="mb-6 rounded-lg border border-danger-line bg-danger-subtle p-4 text-sm text-danger-surface-fg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-md border border-danger-line bg-surface px-3 text-sm font-medium text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Retry
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function StatCard({
  badge,
  description,
  href,
  label,
  progress,
  tone = "neutral",
  trend,
  value,
}: {
  badge?: string;
  description: string;
  href?: string;
  label: string;
  progress?: number;
  tone?: Tone;
  trend?: string;
  value: string;
}) {
  const content = (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-fg-subtle">{label}</p>
        {badge ? <StatusBadge label={badge} tone={tone} /> : null}
      </div>
      <p className="mt-3 break-words text-2xl font-semibold text-fg">{value}</p>
      <p className="mt-2 break-words text-sm leading-5 text-fg-muted">{description}</p>
      {progress !== undefined ? (
        <ProgressBar value={progress} tone={tone} className="mt-4" />
      ) : null}
      {trend ? <p className="mt-3 break-words text-xs font-medium text-fg-subtle">{trend}</p> : null}
    </section>
  );

  if (!href) {
    return content;
  }
  return (
    <Link href={href} className="block h-full min-w-0">
      {content}
    </Link>
  );
}

export function MetricTrendCard(props: Parameters<typeof StatCard>[0]) {
  return <StatCard {...props} />;
}

export function ProgressBar({
  className = "",
  label,
  tone = "info",
  value,
}: {
  className?: string;
  label?: string;
  tone?: Tone;
  value: number;
}) {
  const width = clamp(value);
  const colorClass =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "critical"
          ? "bg-danger"
          : tone === "ai"
            ? "bg-brand"
            : "bg-info";
  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-fg-muted">{label}</span>
          <span className="font-medium text-fg-subtle">{formatPercent(width)}</span>
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({
  label,
  size = 132,
  tone,
  value,
}: {
  label: string;
  size?: number;
  tone?: Tone;
  value: number;
}) {
  const width = clamp(value);
  const color =
    tone === "success"
      ? chartPalette.emerald
      : tone === "warning"
        ? chartPalette.amber
        : tone === "critical"
          ? chartPalette.red
          : tone === "ai"
            ? chartPalette.ai
            : chartPalette.blue;
  return (
    <div className="grid place-items-center gap-2">
      <div
        className="grid rounded-full"
        style={{
          background: `conic-gradient(${color} ${width * 3.6}deg, #E2E8F0 0deg)`,
          height: size,
          placeItems: "center",
          width: size,
        }}
      >
        <div
          className="grid rounded-full bg-surface text-center"
          style={{ height: size - 24, placeItems: "center", width: size - 24 }}
        >
          <span className="text-2xl font-semibold text-fg">
            {formatDecimal(width, 0)}%
          </span>
        </div>
      </div>
      <p className="text-center text-sm font-medium text-fg-muted">{label}</p>
    </div>
  );
}

export function HealthScoreGauge({
  description,
  score,
}: {
  description: string;
  score: number;
}) {
  const normalized = clamp(score);
  const color = getHealthColor(normalized);
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div
          className="mx-auto grid h-44 w-44 shrink-0 rounded-full md:mx-0"
          style={{
            background: `conic-gradient(${color} ${normalized * 3.6}deg, #E2E8F0 0deg)`,
            placeItems: "center",
          }}
        >
          <div className="grid h-32 w-32 place-items-center rounded-full bg-surface text-center">
            <div>
              <p className="text-4xl font-semibold text-fg">
                {formatDecimal(normalized, 0)}
              </p>
              <p className="text-xs font-medium uppercase text-fg-subtle">Health</p>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-fg">Platform Health Score</h3>
            <StatusBadge label={getHealthStatus(normalized)} tone={getStatusTone(getHealthStatus(normalized))} />
          </div>
          <p className="mt-3 text-sm leading-6 text-fg-muted">{description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoPill label="Healthy" value="85-100" tone="success" />
            <InfoPill label="Warning" value="60-84" tone="warning" />
            <InfoPill label="Critical" value="0-59" tone="critical" />
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoPill({ label, tone, value }: { label: string; tone: Tone; value: string }) {
  return (
    <div className={`rounded-md border p-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function chartValueFormatter(value: unknown) {
  if (typeof value === "number") {
    return formatDecimal(value, value % 1 === 0 ? 0 : 2);
  }
  if (value === null || value === undefined) {
    return "n/a";
  }
  return String(value);
}

export function DonutChartCard({
  centerLabel,
  data,
  title,
}: {
  centerLabel?: string;
  data: { color?: string; name: string; value: number }[];
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <ChartCard title={title}>
      {total === 0 ? (
        <EmptyState label="No data to chart yet." />
      ) : (
        <div className="relative h-64 min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={2}
                nameKey="name"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color ?? getStatusColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip formatter={chartValueFormatter} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          {centerLabel ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-semibold text-fg">{formatNumber(total)}</p>
                <p className="text-xs font-medium uppercase text-fg-subtle">{centerLabel}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ChartCard>
  );
}

export function BarChartCard({
  bars,
  data,
  height = 280,
  layout = "horizontal",
  stacked = false,
  title,
  xKey = "name",
}: {
  bars: { color?: string; key: string; name?: string }[];
  data: ChartDatum[];
  height?: number;
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
  title: string;
  xKey?: string;
}) {
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <EmptyState label="No data to chart yet." />
      ) : (
        <div className="min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={layout}
              margin={{ bottom: 8, left: layout === "vertical" ? 42 : 0, right: 16, top: 8 }}
            >
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              {layout === "vertical" ? (
                <>
                  <XAxis type="number" tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis
                    dataKey={xKey}
                    type="category"
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    width={96}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey={xKey} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                </>
              )}
              <Tooltip formatter={chartValueFormatter} />
              <Legend />
              {bars.map((bar) => (
                <Bar
                  key={bar.key}
                  dataKey={bar.key}
                  fill={bar.color ?? chartPalette.blue}
                  name={bar.name ?? bar.key}
                  radius={stacked ? 0 : [4, 4, 0, 0]}
                  stackId={stacked ? "total" : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function LineChartCard({
  data,
  height = 260,
  lines,
  title,
  xKey = "name",
}: {
  data: ChartDatum[];
  height?: number;
  lines: { color?: string; key: string; name?: string }[];
  title: string;
  xKey?: string;
}) {
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <EmptyState label="No time series data recorded yet." />
      ) : (
        <div className="min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ bottom: 8, left: 0, right: 16, top: 8 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fill: "#64748B", fontSize: 12 }} />
              <YAxis domain={[0, 1]} tick={{ fill: "#64748B", fontSize: 12 }} />
              <Tooltip formatter={chartValueFormatter} />
              <Legend />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  dataKey={line.key}
                  dot={{ r: 3 }}
                  name={line.name ?? line.key}
                  stroke={line.color ?? chartPalette.blue}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function AreaChartCard({
  areas,
  data,
  height = 260,
  title,
  xKey = "name",
}: {
  areas: { color?: string; key: string; name?: string }[];
  data: ChartDatum[];
  height?: number;
  title: string;
  xKey?: string;
}) {
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <EmptyState label="No data to chart yet." />
      ) : (
        <div className="min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ bottom: 8, left: 0, right: 16, top: 8 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fill: "#64748B", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
              <Tooltip formatter={chartValueFormatter} />
              <Legend />
              {areas.map((area) => (
                <Area
                  key={area.key}
                  dataKey={area.key}
                  fill={area.color ?? chartPalette.blue}
                  fillOpacity={0.16}
                  name={area.name ?? area.key}
                  stroke={area.color ?? chartPalette.blue}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function EvaluationRadarChart({
  contextPrecision,
  faithfulness,
  hallucinationScore,
  relevance,
  retrievalCoverage,
  title = "RAG Quality Radar",
}: {
  contextPrecision: number;
  faithfulness: number;
  hallucinationScore: number;
  relevance: number;
  retrievalCoverage?: number;
  title?: string;
}) {
  const data = [
    { metric: "Faithfulness", value: clamp(faithfulness * 100) },
    { metric: "Relevance", value: clamp(relevance * 100) },
    { metric: "Context", value: clamp(contextPrecision * 100) },
    { metric: "Safety", value: clamp((1 - hallucinationScore) * 100) },
    { metric: "Coverage", value: clamp((retrievalCoverage ?? contextPrecision) * 100) },
  ];
  return (
    <ChartCard title={title}>
      <div className="h-64 min-w-0 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748B", fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
            <Radar
              dataKey="value"
              fill={chartPalette.ai}
              fillOpacity={0.24}
              name="Score"
              stroke={chartPalette.ai}
              strokeWidth={2}
            />
            <Tooltip formatter={chartValueFormatter} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function QualityScatterChart({
  data,
  onPointClick,
}: {
  data: (ChartDatum & {
    faithfulness: number;
    hallucination_score: number;
    message_id: string;
    relevance: number;
  })[];
  onPointClick?: (messageId: string) => void;
}) {
  return (
    <ChartCard title="Faithfulness vs Relevance">
      {data.length === 0 ? (
        <EmptyState label="No trace points found for these filters." />
      ) : (
        <div className="h-64 min-w-0 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ bottom: 12, left: 0, right: 16, top: 8 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis
                dataKey="relevance"
                domain={[0, 1]}
                name="Relevance"
                tick={{ fill: "#64748B", fontSize: 12 }}
                type="number"
              />
              <YAxis
                dataKey="faithfulness"
                domain={[0, 1]}
                name="Faithfulness"
                tick={{ fill: "#64748B", fontSize: 12 }}
                type="number"
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={chartValueFormatter}
              />
              <Scatter
                data={data}
                name="RAG answer"
                onClick={(point) => {
                  const payload = point as { message_id?: string };
                  if (payload.message_id) {
                    onPointClick?.(payload.message_id);
                  }
                }}
              >
                {data.map((point) => (
                  <Cell
                    key={point.message_id}
                    fill={getHallucinationRisk(point.hallucination_score).color}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function RerankingComparisonChart({ items }: { items: RagTraceRerankingItem[] }) {
  const data = items.slice(0, 10).map((item) => ({
    chunk: `#${item.final_rank ?? item.original_rank ?? "?"}`,
    original_score: item.original_score,
    rerank_score: item.rerank_score ?? 0,
  }));
  return (
    <ChartCard title="Reranking Before And After">
      {items.length === 0 ? (
        <EmptyState label="No reranking details were recorded." />
      ) : (
        <div className="grid gap-5">
          <div className="h-64 min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ bottom: 8, left: 0, right: 16, top: 8 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="chunk" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip formatter={chartValueFormatter} />
                <Legend />
                <Bar dataKey="original_score" fill={chartPalette.blue} name="Original" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rerank_score" fill={chartPalette.ai} name="Reranked" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            {items.slice(0, 8).map((item) => (
              <div
                key={`${item.chunk_id ?? item.filename}-${item.original_rank}-${item.final_rank}`}
                className="grid gap-3 rounded-lg border border-line bg-sunken p-3 text-sm md:grid-cols-4"
              >
                <div>
                  <p className="text-xs font-medium uppercase text-fg-subtle">Original</p>
                  <p className="font-semibold text-fg">#{item.original_rank ?? "n/a"}</p>
                </div>
                <div className="min-w-0 md:col-span-2">
                  <p className="truncate font-medium text-fg">{item.filename}</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {safePreview(item.content_preview, 120)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-fg-subtle">Final</p>
                  <p className="font-semibold text-fg">#{item.final_rank ?? "n/a"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function CitationCard({ citation }: { citation: RagTraceCitation }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-brand-fg">
            Citation {citation.rank}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-fg">
            {citation.filename}
          </h3>
          <p className="mt-1 text-xs text-fg-subtle">
            chunk {citation.chunk_index} - doc {shortenId(citation.document_id)}
          </p>
        </div>
        <StatusBadge label={`Score ${formatDecimal(citation.score, 3)}`} tone="info" />
      </div>
      <p className="mt-4 text-sm leading-6 text-fg-muted">
        {safePreview(citation.content ?? citation.content_preview, 260)}
      </p>
    </article>
  );
}

export function TimelineStep({ step }: { step: RagOpsPipelineStage }) {
  const tone = getStatusTone(step.status);
  return (
    <div className={`min-h-40 rounded-lg border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{step.name}</p>
        <span className="h-3 w-3 shrink-0 rounded-full bg-current" />
      </div>
      <p className="mt-2 text-xs font-medium uppercase">{step.status}</p>
      <p className="mt-3 text-xs leading-5">{step.detail ?? "Waiting for pipeline event."}</p>
      <p className="mt-3 text-xs">{formatDate(step.timestamp)}</p>
    </div>
  );
}

export function PipelineStepper({ steps }: { steps: RagOpsPipelineStage[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold text-fg">Document Pipeline</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <TimelineStep key={step.name} step={step} />
        ))}
      </div>
    </section>
  );
}

export function TraceFlowDiagram({
  steps,
}: {
  steps: { description?: string; label: string; latencyMs?: number | null; status: string }[];
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold text-fg">Trace Flow</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const tone = getStatusTone(step.status);
          return (
            <div key={step.label} className={`relative rounded-lg border p-3 ${toneClasses[tone]}`}>
              <p className="break-words text-sm font-semibold">{step.label}</p>
              <p className="mt-2 text-xs capitalize">{step.status}</p>
              <p className="mt-2 text-xs">{formatLatency(step.latencyMs)}</p>
              {step.description ? (
                <p className="mt-2 line-clamp-2 break-words text-xs opacity-80">
                  {step.description}
                </p>
              ) : null}
              {index < steps.length - 1 ? (
                <span className="absolute right-2 top-2 hidden text-xs text-fg-subtle xl:inline">
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AgentTimeline({ runs }: { runs: RagTraceAgentRun[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold text-fg">Agent Timeline</h3>
      {runs.length === 0 ? (
        <div className="mt-5">
          <EmptyState label="No agent runs were recorded." />
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {runs.map((run, index) => (
            <article key={run.id} className="flex min-w-0 gap-4">
              <div className="hidden shrink-0 md:grid md:justify-items-center">
                <span
                  className="mt-2 h-3 w-3 rounded-full"
                  style={{ backgroundColor: getStatusColor(run.status) }}
                />
                {index < runs.length - 1 ? <span className="mt-2 w-px bg-line" /> : null}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-line bg-sunken p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-fg">{run.agent_type}</h4>
                    <StatusBadge status={run.status} />
                  </div>
                  <span className="text-sm text-fg-muted">
                    {formatLatency(run.latency_ms)} - {formatDate(run.created_at)}
                  </span>
                </div>
                {run.error ? (
                  <p className="mt-3 rounded-md border border-danger-line bg-danger-subtle p-3 text-sm text-danger-surface-fg">
                    {safePreview(run.error, 220)}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <JsonSummary label="Input" value={run.input_preview} />
                  <JsonSummary label="Output" value={run.output_preview ?? {}} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function JsonSummary({ label, value }: { label: string; value: Record<string, unknown> }) {
  const preview = jsonPreviewText(value);

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-semibold uppercase text-fg-subtle">{label} preview</p>
      <p className="mt-2 text-sm leading-5 text-fg-muted">{preview}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-fg-subtle">
          Expand safe JSON
        </summary>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-sunken p-3 text-xs leading-5 text-fg-muted">
          {JSON.stringify(sanitizeDebugJson(value), null, 2)}
        </pre>
      </details>
    </div>
  );
}

function jsonPreviewText(value: Record<string, unknown>) {
  const sanitized = sanitizeDebugJson(value);
  const entries = Object.entries(sanitized as Record<string, unknown>);
  if (entries.length === 0) {
    return "No preview recorded.";
  }
  const preferred = entries.find(([key]) =>
    /question|query|answer|output|response|reason|status|strategy|error/i.test(key),
  );
  const [key, rawValue] = preferred ?? entries[0];
  return `${key}: ${safePreview(formatPreviewValue(rawValue), 220)}`;
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length > 0 ? `Object with keys: ${keys.slice(0, 6).join(", ")}` : "Empty object";
  }
  return String(value);
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0 [&>*]:max-w-full">
        {children}
      </div>
    </section>
  );
}

export function DataTable({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
      {title ? <h3 className="text-base font-semibold text-fg">{title}</h3> : null}
      <div className={title ? "admin-table-scroll mt-4" : "admin-table-scroll"}>{children}</div>
    </section>
  );
}

export function StackedStatusBar({
  segments,
}: {
  segments: { color?: string; label: string; value: number }[];
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return <EmptyState label="No status data available." />;
  }
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-sunken">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="h-full"
            style={{
              backgroundColor: segment.color ?? getStatusColor(segment.label),
              width: `${Math.max(2, (segment.value / total) * 100)}%`,
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((segment) => (
          <span key={segment.label} className="inline-flex items-center gap-2 text-xs text-fg-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: segment.color ?? getStatusColor(segment.label) }}
            />
            {segment.label} {formatNumber(segment.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h3 className="break-words text-base font-semibold text-fg">{title}</h3>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}
