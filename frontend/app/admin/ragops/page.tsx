"use client";

import { AdminAccessMessage, AdminShell } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useControlTower } from "@/features/ragops/hooks";
import { SectionCard } from "@/features/ragops/components/primitives";
import { ExecutiveOverview } from "@/features/ragops/components/ExecutiveOverview";
import { AiInsight } from "@/features/ragops/components/AiInsight";
import { PipelineObservatory } from "@/features/ragops/components/PipelineObservatory";
import { WorkspaceHealthCenter } from "@/features/ragops/components/WorkspaceHealthCenter";
import { RetrievalIntelligence } from "@/features/ragops/components/RetrievalIntelligence";
import { EmbeddingAnalytics } from "@/features/ragops/components/EmbeddingAnalytics";
import { EvaluationIntelligence } from "@/features/ragops/components/EvaluationIntelligence";
import { AgentPerformance } from "@/features/ragops/components/AgentPerformance";
import { FailureCenter } from "@/features/ragops/components/FailureCenter";
import { OperationsCenter } from "@/features/ragops/components/OperationsCenter";

export default function RagOpsControlTowerPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const tower = useControlTower(isAdmin);

  if (isLoading) {
    return <AdminAccessMessage title="AI Control Tower" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="AI Control Tower" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="AI Control Tower"
      description="Real-time RAG platform health: ingestion, embeddings, retrieval, evaluation, agents, and operations."
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-sm text-fg-muted">
          <span className="h-2 w-2 rounded-full bg-success motion-safe:animate-pulse" />
          Live from the platform API · auto-refreshes every 60s
        </p>
        <Button variant="secondary" size="sm" onClick={() => tower.refetch()} isLoading={tower.isFetching}>
          <Icon name="activity" size={15} />
          {tower.isFetching ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {tower.isError ? (
        <div className="mb-5">
          <ErrorState
            title="Some telemetry failed to load"
            message={tower.error}
            action={
              <Button size="sm" variant="secondary" onClick={() => tower.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      ) : null}

      {tower.isLoading ? (
        <div className="grid gap-6">
          <LoadingSkeleton rows={2} variant="metric" />
          <LoadingSkeleton rows={1} variant="card" />
          <LoadingSkeleton rows={3} />
        </div>
      ) : (
        <div className="grid gap-8">
          <SectionCard title="Executive Overview" subtitle="Is the platform healthy right now?" icon="activity">
            <ExecutiveOverview overview={tower.overview} />
          </SectionCard>

          <SectionCard
            title="AI Platform Summary"
            subtitle="Synthesized findings, risks, and recommendations"
            icon="sparkles"
          >
            <AiInsight insights={tower.insights} overview={tower.overview} />
          </SectionCard>

          <SectionCard
            title="Document Pipeline Observatory"
            subtitle="Upload → Extraction → Chunking → Embedding → Indexing → Ready"
            icon="layers"
          >
            <PipelineObservatory overview={tower.overview} qdrant={tower.qdrant} />
          </SectionCard>

          <SectionCard title="Workspace Health Center" subtitle="Worst-performing workspaces first" icon="grid">
            <WorkspaceHealthCenter workspaces={tower.workspaces} />
          </SectionCard>

          <SectionCard
            title="Retrieval Intelligence"
            subtitle="Retrieval readiness, latency, and throughput"
            icon="search"
          >
            <RetrievalIntelligence overview={tower.overview} stats={tower.stats} workspaces={tower.workspaces} />
          </SectionCard>

          <SectionCard
            title="Embedding Analytics"
            subtitle="Vector coverage and Qdrant synchronization"
            icon="box"
          >
            <EmbeddingAnalytics overview={tower.overview} qdrant={tower.qdrant} />
          </SectionCard>

          <SectionCard
            title="Evaluation Intelligence"
            subtitle="Faithfulness, relevance, context precision, hallucination"
            icon="shield"
          >
            <EvaluationIntelligence overview={tower.overview} quality={tower.quality} />
          </SectionCard>

          <SectionCard title="Agent Performance" subtitle="Latency across the RAG agent pipeline" icon="activity">
            <AgentPerformance stats={tower.stats} quality={tower.quality} />
          </SectionCard>

          <SectionCard
            title="Failure Center"
            subtitle="Incidents across ingestion, retrieval, and evaluation"
            icon="alertCircle"
          >
            <FailureCenter
              overview={tower.overview}
              quality={tower.quality}
              errors={tower.errors}
              workspaces={tower.workspaces}
            />
          </SectionCard>

          <SectionCard title="Operations Center" subtitle="Subsystem health" icon="monitor">
            <OperationsCenter qdrant={tower.qdrant} hasStats={Boolean(tower.stats)} />
          </SectionCard>
        </div>
      )}
    </AdminShell>
  );
}
