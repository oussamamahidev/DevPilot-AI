"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const iconBg: Record<Tone, string> = {
  brand: "bg-brand-subtle text-brand-fg",
  success: "bg-success-subtle text-success-fg",
  warning: "bg-warning-subtle text-warning-fg",
  danger: "bg-danger-subtle text-danger-fg",
  info: "bg-info-subtle text-info-fg",
  neutral: "bg-sunken text-fg-muted",
};
const accent: Record<Tone, string> = {
  brand: "bg-brand", success: "bg-success", warning: "bg-warning",
  danger: "bg-danger", info: "bg-info", neutral: "bg-line-strong",
};
const dot: Record<Tone, string> = accent;

/* ─── MetricStrip ────────────────────────────────────────────── */
export type Metric = { label: string; value: string; tone?: Tone; icon?: IconName; hint?: string };

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {metrics.map((m) => (
        <div key={m.label} className="relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-sm">
          <span className={`absolute inset-y-0 left-0 w-1 ${accent[m.tone ?? "neutral"]}`} />
          {m.icon ? (
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconBg[m.tone ?? "neutral"]}`}>
              <Icon name={m.icon} size={17} />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums text-fg">{m.value}</p>
            <p className="truncate text-xs text-fg-subtle">{m.label}{m.hint ? ` · ${m.hint}` : ""}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── SearchBox ──────────────────────────────────────────────── */
export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

/* ─── FilterPills (segmented) ────────────────────────────────── */
export function FilterPills({ options, value, onChange, ariaLabel }: { options: { value: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value || "__all"} type="button" onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${active ? "bg-brand text-white" : "text-fg-muted hover:bg-hover hover:text-fg"}`}>
            {o.label}
            {typeof o.count === "number" ? (
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-sunken"}`}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ─── BulkBar ────────────────────────────────────────────────── */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-subtle-line bg-brand-subtle px-3 py-2 shadow-sm animate-dp-slide-up">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-fg">
        <Icon name="checkCircle" size={15} />
        {count} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        Clear
      </button>
    </div>
  );
}

export function BulkButton({ onClick, icon, tone = "neutral", children }: { onClick: () => void; icon?: IconName; tone?: "neutral" | "danger"; children: ReactNode }) {
  const cls = tone === "danger"
    ? "border-danger-line bg-surface text-danger-fg hover:bg-danger-subtle"
    : "border-line bg-surface text-fg-muted hover:bg-hover hover:text-fg";
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${cls}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </button>
  );
}

/* ─── Checkbox (with indeterminate) ──────────────────────────── */
export function Check({ checked, indeterminate = false, disabled = false, onChange, ariaLabel }: { checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate && !checked; }, [indeterminate, checked]);
  return (
    <input
      ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={ariaLabel}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-line accent-[#6a35f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

/* ─── StatusDot / MiniBar ────────────────────────────────────── */
export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot[tone]} ${pulse ? "motion-safe:animate-pulse" : ""}`} />;
}

export function MiniBar({ value, tone = "success" }: { value: number; tone?: "success" | "warning" | "danger" | "brand" }) {
  const w = Math.max(0, Math.min(100, value));
  const c = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-danger" : "bg-brand";
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
      <div className={`h-full rounded-full ${c}`} style={{ width: `${w}%` }} />
    </div>
  );
}

/* ─── DataSection (table card shell) ─────────────────────────── */
export function DataSection({ title, count, countLabel, actions, children }: { title: string; count?: number; countLabel?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {typeof count === "number" ? (
            <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-xs tabular-nums text-fg-muted">{count}{countLabel ? ` ${countLabel}` : ""}</span>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* ─── Pager ──────────────────────────────────────────────────── */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const canPrev = page > 0;
  const canNext = (page + 1) * pageSize < total;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <p className="text-xs text-fg-subtle tabular-nums">{from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" disabled={!canPrev} onClick={() => onPage(page - 1)} aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg-muted transition hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="chevronRight" size={15} className="rotate-180" />
        </button>
        <button type="button" disabled={!canNext} onClick={() => onPage(page + 1)} aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg-muted transition hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}

/* ─── CSV export ─────────────────────────────────────────────── */
export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0 || typeof document === "undefined") return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
