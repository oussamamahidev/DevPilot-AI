"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAccessMessage, AdminShell } from "@/components/admin/AdminUI";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useTraceInspector } from "@/features/trace-inspector/hooks";
import {
  AgentTimeline,
  TraceGraph,
  TraceSummary,
} from "@/features/trace-inspector/components/FlowSections";
import {
  CitationExplorer,
  RerankingExplorer,
  RetrievalExplorer,
} from "@/features/trace-inspector/components/RetrievalSections";
import {
  CorrectorAnalysis,
  EvaluationCenter,
  JsonDebug,
  LlmUsage,
} from "@/features/trace-inspector/components/AnalysisSections";

export default function RagTraceInspectorPage() {
  const params = useParams<{ messageId: string }>();
  const messageId = params.messageId;
  const { isAdmin, isLoading, isSuperAdmin } = useAdminAccess();
  const [includeContent, setIncludeContent] = useState(false);
  const inspector = useTraceInspector(messageId, includeContent, isAdmin);

  useEffect(() => {
    if (!isSuperAdmin && includeContent) setIncludeContent(false);
  }, [isSuperAdmin, includeContent]);

  if (isLoading) return <AdminAccessMessage title="AI Trace Inspector" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="AI Trace Inspector" label="Admin access required." />;

  return (
    <AdminShell
      title="AI Trace Inspector"
      description="From question to final answer — retrieval, reranking, generation, evaluation, and correction."
    >
      <div className="grid min-w-0 gap-5">
        {/* header bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/admin/rag-traces"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Icon name="arrowLeft" size={15} />
            All traces
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium ${
                isSuperAdmin ? "border-line bg-surface text-fg-muted" : "cursor-not-allowed border-line bg-sunken text-fg-subtle"
              }`}
            >
              <input
                type="checkbox"
                checked={includeContent}
                disabled={!isSuperAdmin}
                onChange={(e) => setIncludeContent(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#6a35f0]"
              />
              Full chunk content
            </label>
            <button
              type="button"
              onClick={() => inspector.refetch()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Icon name="refreshCw" size={14} className={inspector.isFetching ? "motion-safe:animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {!isSuperAdmin ? (
          <p className="rounded-lg border border-warning-line bg-warning-subtle px-3 py-2 text-xs text-warning-surface-fg">
            Full chunk content is restricted to super admins — safe previews are shown by default.
          </p>
        ) : null}

        {inspector.isError ? (
          <ErrorState
            title="Unable to load trace"
            message={inspector.error}
            action={
              <button
                type="button"
                onClick={() => inspector.refetch()}
                className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Retry
              </button>
            }
          />
        ) : null}

        {inspector.isLoading ? (
          <div className="grid gap-5">
            <LoadingSkeleton variant="card" rows={1} />
            <LoadingSkeleton rows={5} />
          </div>
        ) : inspector.trace ? (
          <div className="grid min-w-0 gap-6">
            <TraceSummary trace={inspector.trace} evaluation={inspector.evaluation} />
            <AgentTimeline trace={inspector.trace} />
            <RetrievalExplorer trace={inspector.trace} retrieval={inspector.retrieval} />
            <RerankingExplorer reranking={inspector.reranking} />
            <CitationExplorer trace={inspector.trace} />
            <EvaluationCenter trace={inspector.trace} evaluation={inspector.evaluation} />
            <CorrectorAnalysis trace={inspector.trace} />
            <LlmUsage trace={inspector.trace} />
            <TraceGraph trace={inspector.trace} />
            <JsonDebug trace={inspector.trace} />
          </div>
        ) : !inspector.isError ? (
          <EmptyState
            title="Trace not found"
            description="This message has no stored trace, or the ID is invalid. Ask a question to generate traces."
            icon={<Icon name="search" size={22} />}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
