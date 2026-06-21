import { StatusBadge } from "@/components/ui/StatusBadge";
import type { RagOpsQdrantHealth } from "@/types";
import type { OverviewMetrics } from "@/features/ragops/types";
import {
  coverageTone,
  fmtNumber,
  fmtPercent,
  GaugeStat,
} from "@/features/ragops/components/primitives";

export function EmbeddingAnalytics({
  overview,
  qdrant,
}: {
  overview: OverviewMetrics;
  qdrant: RagOpsQdrantHealth | undefined;
}) {
  const pgVectors = qdrant?.postgres_chunks_with_vector_id ?? overview.chunksWithVectors;
  const qVectors = qdrant?.qdrant_vectors_count ?? null;
  const maxVectors = Math.max(pgVectors, qVectors ?? 0, 1);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <GaugeStat
        label="Embedding Coverage"
        percent={overview.embeddingCoverage * 100}
        centerText={fmtPercent(overview.embeddingCoverage)}
        tone={coverageTone(overview.embeddingCoverage)}
        footer={`${fmtNumber(overview.chunksWithVectors)} / ${fmtNumber(overview.totalChunks)} chunks`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-fg-muted">Missing Embeddings</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-fg">
            {fmtNumber(overview.chunksMissing)}
          </p>
          <p className="mt-2 text-xs text-fg-subtle">chunks without a vector id</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-fg-muted">Qdrant Sync</p>
            <StatusBadge
              label={qdrant?.reachable ? "Reachable" : "Unreachable"}
              tone={qdrant?.reachable ? "success" : "critical"}
            />
          </div>
          <p className="mt-3 truncate text-sm text-fg">
            Collection{" "}
            <span className="font-mono text-xs text-fg-muted">{qdrant?.collection_name ?? "—"}</span>
          </p>
          <p className="mt-1 truncate text-xs text-fg-subtle">
            Mismatch {qdrant?.mismatch_count == null ? "unknown" : fmtNumber(qdrant.mismatch_count)}
            {qdrant?.error ? ` · ${qdrant.error}` : ""}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:col-span-2">
          <p className="mb-3 text-sm font-medium text-fg">Vector Count Comparison</p>
          <div className="grid gap-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-fg-subtle">Postgres (vector ids)</span>
                <span className="font-semibold tabular-nums text-fg">{fmtNumber(pgVectors)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-info" style={{ width: `${(pgVectors / maxVectors) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-fg-subtle">Qdrant (vectors)</span>
                <span className="font-semibold tabular-nums text-fg">
                  {qVectors == null ? "unknown" : fmtNumber(qVectors)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${((qVectors ?? 0) / maxVectors) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
