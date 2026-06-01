"use client";

import type { RagTraceListItem } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  type Tone,
  faithfulnessBuckets,
  hallucinationBuckets,
  latencyBuckets,
  workspaceComparison,
} from "@/features/trace-observatory/helpers";
import { toneBar, toneText, toneChip } from "@/features/trace-inspector/components/primitives";

type Bucket = { label: string; count: number; tone: Tone };

/* ─── reusable vertical column histogram ─────────────────────── */
function BarHistogram({
  title,
  icon,
  buckets,
  total,
}: {
  title: string;
  icon: IconName;
  buckets: Bucket[];
  total: number;
}) {
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  const ariaLabel = `${title}: ${buckets.map((b) => `${b.label}: ${b.count} traces`).join(", ")}`;

  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-fg">
          <Icon name={icon} size={15} className="shrink-0 text-fg-subtle" />
          <span className="truncate">{title}</span>
        </h3>
        <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{total} traces</span>
      </div>

      <div role="img" aria-label={ariaLabel} className="flex h-32 items-end justify-between gap-2">
        {buckets.map((b, i) => {
          const pct = maxCount === 0 ? 0 : (b.count / maxCount) * 100;
          return (
            <div key={`${b.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={`text-[11px] font-medium tabular-nums ${
                  b.count > 0 ? toneText[b.tone] : "text-fg-subtle"
                }`}
              >
                {b.count}
              </span>
              <div className="flex h-full w-full items-end">
                <div
                  className={`w-full rounded-t ${toneBar[b.tone]}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="text-center text-[10px] leading-tight text-fg-subtle">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── workspace comparison (horizontal bars, worst first) ────── */
type WorkspaceStat = ReturnType<typeof workspaceComparison>[number];

function WorkspaceComparison({ stats }: { stats: WorkspaceStat[] }) {
  const rows = stats.slice(0, 8);

  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-fg">
          <Icon name="layers" size={15} className="shrink-0 text-fg-subtle" />
          <span className="truncate">Workspace comparison</span>
        </h3>
        <span className="shrink-0 text-xs text-fg-subtle">avg faithfulness · worst first</span>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((w) => {
          const value = Math.round(w.avgFaithfulness * 100);
          return (
            <li key={w.id} className="flex min-w-0 items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-fg" title={w.name}>
                {w.name}
              </span>
              <div className="hidden h-2 w-40 shrink-0 overflow-hidden rounded-full bg-sunken sm:block">
                <div className={`h-full rounded-full ${toneBar[w.tone]}`} style={{ width: `${value}%` }} />
              </div>
              <span className={`w-12 shrink-0 text-right text-sm font-medium tabular-nums ${toneText[w.tone]}`}>
                {value}%
              </span>
              <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs tabular-nums ${toneChip[w.tone]}`}
              >
                n={w.count}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-fg-subtle">Lower faithfulness = poorer retrieval.</p>
    </div>
  );
}

/* ─── public component ───────────────────────────────────────── */
export function Distributions({ items }: { items: RagTraceListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <Icon name="activity" size={20} className="mx-auto text-fg-subtle" />
        <p className="mt-2 text-sm text-fg-muted">
          No traces match the current filters — adjust filters to see distributions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <BarHistogram
          title="Faithfulness distribution"
          icon="shield"
          buckets={faithfulnessBuckets(items)}
          total={items.length}
        />
        <BarHistogram
          title="Hallucination distribution"
          icon="alertCircle"
          buckets={hallucinationBuckets(items)}
          total={items.length}
        />
        <BarHistogram
          title="Latency distribution"
          icon="clock"
          buckets={latencyBuckets(items)}
          total={items.length}
        />
      </div>

      <WorkspaceComparison stats={workspaceComparison(items)} />
    </div>
  );
}
