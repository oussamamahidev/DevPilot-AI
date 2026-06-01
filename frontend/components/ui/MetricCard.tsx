import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { toneClasses, type StatusTone } from "@/components/ui/StatusBadge";

type Delta = { value: string; direction: "up" | "down" | "flat" };

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  /** Short qualifier shown next to the label (e.g. "last 24h"). */
  hint?: string;
  /** Accent for the optional leading icon badge. */
  tone?: StatusTone;
  icon?: ReactNode;
  /** Period-over-period delta chip. */
  delta?: Delta;
  /** When set, the whole card becomes a link. */
  href?: string;
};

const deltaTone: Record<Delta["direction"], string> = {
  up: "text-success-fg",
  down: "text-danger-fg",
  flat: "text-fg-subtle",
};
const deltaGlyph: Record<Delta["direction"], string> = { up: "▲", down: "▼", flat: "→" };

/**
 * KPI tile. The single metric primitive — supersedes the historical StatCard,
 * MetricStrip item, MetricTrendCard and admin MetricCard. The minimal
 * `{ label, value, detail }` form is preserved for backwards compatibility.
 */
export function MetricCard({ label, value, detail, hint, tone = "neutral", icon, delta, href }: MetricCardProps) {
  const body = (
    <Card className={href ? "transition group-hover:border-line-strong" : ""}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg-subtle">
            {label}
            {hint ? <span className="text-fg-subtle/70"> · {hint}</span> : null}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-fg">{value}</p>
        </div>
        {icon ? (
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${toneClasses[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {detail || delta ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {delta ? (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${deltaTone[delta.direction]}`}
            >
              <span aria-hidden="true">{deltaGlyph[delta.direction]}</span>
              {delta.value}
            </span>
          ) : null}
          {detail ? <p className="text-sm leading-6 text-fg-muted">{detail}</p> : null}
        </div>
      ) : null}
    </Card>
  );

  if (!href) return body;
  return (
    <Link
      href={href}
      className="group block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      {body}
    </Link>
  );
}
