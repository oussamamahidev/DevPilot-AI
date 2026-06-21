import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";

type StatCardProps = {
  badge?: string;
  children?: ReactNode;
  description?: string;
  href?: string;
  label: string;
  tone?: StatusTone;
  value: string;
};

export function StatCard({
  badge,
  children,
  description,
  href,
  label,
  tone = "neutral",
  value,
}: StatCardProps) {
  const content = (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 text-fg shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-fg-muted">{label}</p>
        {badge ? <StatusBadge label={badge} tone={tone} /> : null}
      </div>
      <p className="mt-3 break-words text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {description ? (
        <p className="mt-2 break-words text-sm leading-5 text-fg-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block h-full min-w-0 rounded-lg transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      {content}
    </Link>
  );
}
