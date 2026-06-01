"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { scoreTone, type AgentStatus, type Tone } from "@/features/trace-inspector/helpers";

export const toneBar: Record<Tone, string> = {
  success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", ai: "bg-brand", neutral: "bg-line-strong",
};
export const toneChip: Record<Tone, string> = {
  success: "border-success-line bg-success-subtle text-success-surface-fg",
  warning: "border-warning-line bg-warning-subtle text-warning-surface-fg",
  danger: "border-danger-line bg-danger-subtle text-danger-surface-fg",
  info: "border-info-line bg-info-subtle text-info-surface-fg",
  ai: "border-brand-subtle-line bg-brand-subtle text-brand-fg",
  neutral: "border-line bg-sunken text-fg-muted",
};
export const toneText: Record<Tone, string> = {
  success: "text-success-fg", warning: "text-warning-fg", danger: "text-danger-fg", info: "text-info-fg", ai: "text-brand-fg", neutral: "text-fg-muted",
};

/* ─── Section shell (anchor target for the trace graph) ──────── */
export function Section({
  id, num, icon, title, subtitle, actions, children,
}: {
  id?: string; num?: number; icon?: IconName; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {typeof num === "number" ? (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-subtle text-[11px] font-bold text-brand-fg">{num}</span>
          ) : null}
          {icon ? <Icon name={icon} size={16} className="shrink-0 text-fg-subtle" /> : null}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-fg-subtle">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-w-0 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* ─── CopyButton ─────────────────────────────────────────────── */
export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }
  const h = size === "xs" ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text-xs";
  return (
    <button type="button" onClick={copy} title={`Copy ${label}`}
      className={`inline-flex items-center gap-1 rounded-md border border-line bg-surface font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${h}`}>
      <Icon name={copied ? "checkCircle" : "fileText"} size={12} className={copied ? "text-success-fg" : ""} />
      {copied ? "Copied" : label}
    </button>
  );
}

/* ─── ScoreBar ───────────────────────────────────────────────── */
export function ScoreBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const tone = scoreTone(value, invert);
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-fg-muted">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-fg">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ─── ToneBadge ──────────────────────────────────────────────── */
export function ToneBadge({ tone, label, icon }: { tone: Tone; label: string; icon?: IconName }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneChip[tone]}`}>
      {icon ? <Icon name={icon} size={11} /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

/* ─── AgentStatusChip ────────────────────────────────────────── */
const STATUS_META: Record<AgentStatus, { label: string; tone: Tone; dot: string }> = {
  completed: { label: "Completed", tone: "success", dot: "bg-success" },
  failed: { label: "Failed", tone: "danger", dot: "bg-danger" },
  running: { label: "Running", tone: "info", dot: "bg-info" },
  skipped: { label: "Skipped", tone: "neutral", dot: "bg-line-strong" },
};
export function AgentStatusChip({ status }: { status: AgentStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneChip[m.tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${status === "running" ? "motion-safe:animate-pulse" : ""}`} />
      {m.label}
    </span>
  );
}

/* ─── KeyVal ─────────────────────────────────────────────────── */
export function KeyVal({ label, value, mono = false, tone }: { label: string; value: ReactNode; mono?: boolean; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-medium ${tone ? toneText[tone] : "text-fg"} ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

/* ─── Panel (labeled bordered box) ───────────────────────────── */
export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-lg border border-line bg-sunken ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</p>
          {action}
        </div>
      ) : null}
      <div className="p-3">{children}</div>
    </div>
  );
}
