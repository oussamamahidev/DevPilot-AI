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
    <section className="min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {badge ? <StatusBadge label={badge} tone={tone} /> : null}
      </div>
      <p className="mt-3 break-words text-2xl font-semibold text-slate-950">{value}</p>
      {description ? (
        <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
