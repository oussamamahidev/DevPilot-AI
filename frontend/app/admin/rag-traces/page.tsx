"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  formatDate,
  formatDecimal,
  formatNumber,
  PaginationControls,
} from "@/components/admin/AdminUI";
import {
  chartPalette,
  DonutChartCard,
  EmptyState,
  ErrorCard,
  FilterBar,
  formatLatency,
  LoadingSkeleton,
  PageHeader,
  QualityBadge,
  QualityScatterChart,
  RefreshButton,
  RiskBadge,
  safePreview,
  StatCard,
  StatusBadge,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getRagTraceQualitySummary, listRagOpsWorkspaces, listRagTraces } from "@/lib/admin";
import type {
  RagOpsWorkspaceSummary,
  RagTraceListItem,
  RagTraceListResponse,
  RagTraceQualitySummary,
} from "@/types";

const PAGE_SIZE = 30;

export default function RagTracesPage() {
  const router = useRouter();
  const { isAdmin, isLoading } = useAdminAccess();
  const [data, setData] = useState<RagTraceListResponse | null>(null);
  const [summary, setSummary] = useState<RagTraceQualitySummary | null>(null);
  const [workspaces, setWorkspaces] = useState<RagOpsWorkspaceSummary[]>([]);
  const [search, setSearch] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [retrievalStrategy, setRetrievalStrategy] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [minFaithfulness, setMinFaithfulness] = useState("");
  const [maxHallucination, setMaxHallucination] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const filters = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      max_hallucination_score: maxHallucination
        ? Number(maxHallucination)
        : riskFilter === "low"
          ? 0.3
          : riskFilter === "medium"
            ? 0.6
            : undefined,
      min_faithfulness: minFaithfulness ? Number(minFaithfulness) : undefined,
      page: page + 1,
      page_size: PAGE_SIZE,
      retrieval_strategy: retrievalStrategy || undefined,
      search: search || undefined,
      workspace_id: workspaceId || undefined,
    }),
    [
      dateFrom,
      dateTo,
      maxHallucination,
      minFaithfulness,
      page,
      retrievalStrategy,
      riskFilter,
      search,
      workspaceId,
    ],
  );

  const load = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const [traceData, qualityData, workspaceData] = await Promise.all([
        listRagTraces(filters),
        getRagTraceQualitySummary(),
        listRagOpsWorkspaces(),
      ]);
      setData(traceData);
      setSummary(qualityData);
      setWorkspaces(workspaceData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load RAG traces.");
    } finally {
      setIsFetching(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [
    search,
    workspaceId,
    retrievalStrategy,
    riskFilter,
    minFaithfulness,
    maxHallucination,
    dateFrom,
    dateTo,
  ]);

  if (isLoading) {
    return <AdminAccessMessage title="RAG Trace Explorer" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="RAG Trace Explorer" label="Admin access required." />;
  }

  const traces = filterByRisk(data?.items ?? [], riskFilter);
  const total = data?.total ?? 0;
  const averages = summarizeTraces(traces, summary);

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="Inspect retrieval, reranking, generation, evaluation, and correction for every answer."
    >
      <PageHeader
        title="RAG Trace Explorer"
        subtitle="Inspect retrieval, reranking, generation, evaluation, and correction for every answer."
        actions={<RefreshButton isFetching={isFetching} onClick={() => void load()} />}
      />
      <ErrorCard message={error} onRetry={() => void load()} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total RAG Queries"
          value={formatNumber(summary?.total_rag_queries ?? total)}
          description={`${formatNumber(traces.length)} visible on this page`}
          badge="Queries"
          tone="info"
        />
        <StatCard
          label="Average Faithfulness"
          value={formatDecimal(averages.faithfulness, 2)}
          description="Answer grounding in retrieved context"
          progress={averages.faithfulness * 100}
          badge={averages.faithfulness >= 0.75 ? "Strong" : "Watch"}
          tone={averages.faithfulness >= 0.75 ? "success" : "warning"}
        />
        <StatCard
          label="Average Relevance"
          value={formatDecimal(averages.relevance, 2)}
          description="Question and answer alignment"
          progress={averages.relevance * 100}
          badge="Quality"
          tone={averages.relevance >= 0.75 ? "success" : "warning"}
        />
        <StatCard
          label="Context Precision"
          value={formatDecimal(averages.contextPrecision, 2)}
          description="Retrieved context usefulness"
          progress={averages.contextPrecision * 100}
          badge="Retrieval"
          tone={averages.contextPrecision >= 0.75 ? "success" : "warning"}
        />
        <StatCard
          label="Hallucination Risk"
          value={formatDecimal(averages.hallucination, 2)}
          description="Lower is better"
          progress={averages.hallucination * 100}
          badge="Risk"
          tone={averages.hallucination <= 0.3 ? "success" : averages.hallucination <= 0.6 ? "warning" : "critical"}
        />
        <StatCard
          label="Corrected Answers"
          value={formatNumber(summary?.corrected_answers_count ?? traces.filter((item) => item.corrected).length)}
          description="CorrectorAgent changed output"
          badge="Corrector"
          tone="ai"
        />
      </section>

      <FilterBar>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search question"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 xl:col-span-2"
        />
        <select
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All workspaces</option>
          {workspaces.map((workspace) => (
            <option key={workspace.workspace_id} value={workspace.workspace_id}>
              {workspace.workspace_name}
            </option>
          ))}
        </select>
        <select
          value={retrievalStrategy}
          onChange={(event) => setRetrievalStrategy(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All strategies</option>
          <option value="semantic">Semantic</option>
          <option value="keyword">Keyword</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select
          value={riskFilter}
          onChange={(event) => setRiskFilter(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All risk</option>
          <option value="low">Low risk</option>
          <option value="medium">Medium risk</option>
          <option value="high">High risk</option>
        </select>
        <input
          value={minFaithfulness}
          onChange={(event) => setMinFaithfulness(event.target.value)}
          placeholder="Min faithfulness"
          type="number"
          min="0"
          max="1"
          step="0.05"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        />
        <input
          value={maxHallucination}
          onChange={(event) => setMaxHallucination(event.target.value)}
          placeholder="Max hallucination"
          type="number"
          min="0"
          max="1"
          step="0.05"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        />
        <input
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          type="date"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        />
        <input
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          type="date"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        />
      </FilterBar>

      {isFetching && !data ? <LoadingSkeleton rows={4} /> : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <QualityScatterChart
          data={traces.map((trace) => ({
            faithfulness: trace.faithfulness,
            hallucination_score: trace.hallucination_score,
            message_id: trace.message_id,
            name: safePreview(trace.question_preview, 40),
            relevance: trace.relevance,
          }))}
          onPointClick={(messageId) => router.push(`/admin/rag-traces/${messageId}`)}
        />
        <DonutChartCard
          title="Hallucination Risk Buckets"
          centerLabel="Risk"
          data={riskBucketData(traces).map((bucket) => ({
            color:
              bucket.risk === "Low"
                ? chartPalette.emerald
                : bucket.risk === "Medium"
                  ? chartPalette.amber
                  : chartPalette.red,
            name: bucket.risk,
            value: bucket.count,
          }))}
        />
      </div>

      <section className="mt-6 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-950">Trace Table</h3>
          <span className="text-sm text-slate-500">{formatNumber(total)} traces</span>
        </div>
        {traces.length === 0 && !isFetching ? (
          <EmptyState label="No traces available yet. Ask a question to generate traces." />
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Question</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Answer</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Strategy</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Citations</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Faithfulness</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Risk</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Corrected</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Latency</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {traces.map((trace) => (
                  <TraceRow key={trace.message_id} trace={trace} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls
          page={page}
          setPage={setPage}
          canPrevious={page > 0}
          canNext={(page + 1) * PAGE_SIZE < total}
        />
      </section>
    </AdminShell>
  );
}

function TraceRow({ trace }: { trace: RagTraceListItem }) {
  return (
    <tr>
      <td className="max-w-sm px-3 py-3">
        <p className="font-medium text-slate-950">{safePreview(trace.question_preview, 90)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {trace.workspace_name} - {formatDate(trace.created_at)}
        </p>
      </td>
      <td className="max-w-sm px-3 py-3 text-slate-700">
        {safePreview(trace.answer_preview, 100)}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
        {trace.retrieval_strategy ?? "unknown"}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <StatusBadge
          label={formatNumber(trace.citation_count)}
          tone={trace.citation_count > 0 ? "success" : "warning"}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <QualityBadge label="F" value={trace.faithfulness} />
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <RiskBadge value={trace.hallucination_score} />
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <StatusBadge
          label={trace.corrected ? "Corrected" : "Original"}
          tone={trace.corrected ? "ai" : "neutral"}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
        {formatLatency(trace.total_latency_ms)}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <Link
          href={`/admin/rag-traces/${trace.message_id}`}
          className="font-medium text-slate-950 underline-offset-4 hover:underline"
        >
          View trace
        </Link>
      </td>
    </tr>
  );
}

function summarizeTraces(
  traces: RagTraceListItem[],
  summary: RagTraceQualitySummary | null,
) {
  if (traces.length === 0) {
    return {
      contextPrecision: summary?.average_context_precision ?? 0,
      faithfulness: summary?.average_faithfulness ?? 0,
      hallucination: summary?.average_hallucination_score ?? 0,
      relevance: summary?.average_relevance ?? 0,
    };
  }
  return {
    contextPrecision: average(traces.map((trace) => trace.context_precision)),
    faithfulness: average(traces.map((trace) => trace.faithfulness)),
    hallucination: average(traces.map((trace) => trace.hallucination_score)),
    relevance: average(traces.map((trace) => trace.relevance)),
  };
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function filterByRisk(traces: RagTraceListItem[], riskFilter: string) {
  if (riskFilter === "low") {
    return traces.filter((trace) => trace.hallucination_score <= 0.3);
  }
  if (riskFilter === "medium") {
    return traces.filter(
      (trace) => trace.hallucination_score > 0.3 && trace.hallucination_score <= 0.6,
    );
  }
  if (riskFilter === "high") {
    return traces.filter((trace) => trace.hallucination_score > 0.6);
  }
  return traces;
}

function riskBucketData(traces: RagTraceListItem[]) {
  return [
    { count: traces.filter((trace) => trace.hallucination_score <= 0.3).length, risk: "Low" },
    {
      count: traces.filter(
        (trace) => trace.hallucination_score > 0.3 && trace.hallucination_score <= 0.6,
      ).length,
      risk: "Medium",
    },
    { count: traces.filter((trace) => trace.hallucination_score > 0.6).length, risk: "High" },
  ];
}
