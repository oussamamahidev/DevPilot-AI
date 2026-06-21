"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { RagTraceListItem } from "@/types";
import {
  topByHallucination,
  correctedTraces,
  slowestTraces,
  worstFaithfulness,
  formatLatency,
  type Tone,
} from "@/features/trace-observatory/helpers";
import { toneChip, toneText } from "@/features/trace-inspector/components/primitives";

function AlertPanel({
  title,
  icon,
  tone,
  rows,
  metric,
}: {
  title: string;
  icon: IconName;
  tone: Tone;
  rows: RagTraceListItem[];
  metric: (t: RagTraceListItem) => { text: string; tone: Tone };
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Icon name={icon} size={15} className={`shrink-0 ${toneText[tone]}`} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-fg-subtle">Nothing flagged.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((t) => {
            const m = metric(t);
            return (
              <li key={t.message_id} className="min-w-0">
                <Link
                  href={`/admin/rag-traces/${t.message_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
                    {t.question_preview || "—"}
                  </span>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${toneChip[m.tone]}`}
                  >
                    {m.text}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AlertsRail({ items }: { items: RagTraceListItem[] }) {
  return (
    <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AlertPanel
        title="Most hallucinated"
        icon="alertCircle"
        tone="danger"
        rows={topByHallucination(items)}
        metric={(t) => ({ text: `${Math.round(t.hallucination_score * 100)}%`, tone: "danger" })}
      />
      <AlertPanel
        title="Recently corrected"
        icon="refreshCw"
        tone="info"
        rows={correctedTraces(items)}
        metric={() => ({ text: "Corrected", tone: "info" })}
      />
      <AlertPanel
        title="Slowest traces"
        icon="clock"
        tone="warning"
        rows={slowestTraces(items)}
        metric={(t) => ({ text: formatLatency(t.total_latency_ms), tone: "warning" })}
      />
      <AlertPanel
        title="Worst faithfulness"
        icon="shield"
        tone="danger"
        rows={worstFaithfulness(items)}
        metric={(t) => ({ text: `${Math.round(t.faithfulness * 100)}%`, tone: "danger" })}
      />
    </div>
  );
}
