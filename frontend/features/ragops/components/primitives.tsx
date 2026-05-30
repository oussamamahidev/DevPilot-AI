import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export type Tone = "success" | "warning" | "critical" | "info" | "ai" | "neutral";

const numberFormat = new Intl.NumberFormat("en-US");
export const fmtNumber = (value: number) => numberFormat.format(Math.round(value));
export const fmtPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
export const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const scoreTone = (score: number): Tone =>
  score >= 85 ? "success" : score >= 60 ? "warning" : "critical";
export const qualityTone = (value: number): Tone =>
  value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "critical";
export const riskTone = (value: number): Tone =>
  value <= 0.3 ? "success" : value <= 0.6 ? "warning" : "critical";
export const coverageTone = (ratio: number): Tone =>
  ratio >= 0.85 ? "success" : ratio >= 0.6 ? "warning" : "critical";

const strokeClasses: Record<Tone, string> = {
  ai: "stroke-brand",
  critical: "stroke-danger",
  info: "stroke-info",
  neutral: "stroke-line-strong",
  success: "stroke-success",
  warning: "stroke-warning",
};
const dotClasses: Record<Tone, string> = {
  ai: "bg-brand",
  critical: "bg-danger",
  info: "bg-info",
  neutral: "bg-line-strong",
  success: "bg-success",
  warning: "bg-warning",
};

export function SectionCard({
  title,
  subtitle,
  icon,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-fg">
              <Icon name={icon} size={16} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-fg">{title}</h2>
            {subtitle ? <p className="truncate text-sm text-fg-muted">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Theme-aware radial gauge (SVG, token-driven stroke) for 0–100 ratio KPIs. */
export function GaugeStat({
  label,
  percent,
  centerText,
  tone,
  footer,
}: {
  label: string;
  percent: number;
  centerText: string;
  tone: Tone;
  footer?: ReactNode;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const fill = clampPercent(percent);
  const offset = circumference * (1 - fill / 100);

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="truncate text-sm font-medium text-fg-muted">{label}</p>
      <div className="relative mx-auto mt-3 grid h-28 w-28 place-items-center">
        <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-line" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={strokeClasses[tone]}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute text-2xl font-semibold tabular-nums text-fg">{centerText}</span>
      </div>
      {footer ? <div className="mt-3 text-center text-xs text-fg-subtle">{footer}</div> : null}
    </div>
  );
}

export function CountStat({
  label,
  value,
  icon,
  sub,
  footer,
}: {
  label: string;
  value: string;
  icon?: IconName;
  sub?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-fg-muted">{label}</p>
        {icon ? <Icon name={icon} size={16} className="shrink-0 text-fg-subtle" /> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-fg">{value}</p>
      {sub ? <div className="mt-3">{sub}</div> : null}
      {footer ? <div className="mt-2 text-xs text-fg-subtle">{footer}</div> : null}
    </div>
  );
}

export function HealthDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClasses[tone]}`} />
      {label}
    </span>
  );
}

/** Honest "distance from SLO target" indicator (no fabricated time-deltas). */
export function TargetDelta({
  value,
  target,
  invert = false,
  fractionDigits = 2,
}: {
  value: number;
  target: number;
  invert?: boolean;
  fractionDigits?: number;
}) {
  const above = value >= target;
  const good = invert ? !above : above;
  const diff = value - target;
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${good ? "text-success-fg" : "text-warning-fg"}`}
    >
      <Icon name="arrowRight" size={11} className={above ? "-rotate-90" : "rotate-90"} />
      {`${diff >= 0 ? "+" : ""}${diff.toFixed(fractionDigits)} vs ${target.toFixed(fractionDigits)} target`}
    </span>
  );
}

/** Truthful capability gap — names the exact endpoint that would enable the view. */
export function AwaitingTelemetry({ label, endpoint }: { label: string; endpoint: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-line bg-sunken px-3.5 py-3 text-xs text-fg-subtle">
      <Icon name="alertCircle" size={14} className="mt-0.5 shrink-0" />
      <span>
        {label} isn&apos;t exposed by the API yet. Add{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-fg-muted">
          {endpoint}
        </code>{" "}
        to light this up.
      </span>
    </div>
  );
}

export function InsightRow({
  tone,
  title,
  detail,
  href,
}: {
  tone: Tone;
  title: string;
  detail: string;
  href?: string;
}) {
  const body = (
    <div className="flex gap-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClasses[tone]}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs leading-5 text-fg-muted">{detail}</p>
      </div>
      {href ? <Icon name="chevronRight" size={14} className="ml-auto mt-1 shrink-0 text-fg-subtle" /> : null}
    </div>
  );
  if (!href) {
    return <div className="rounded-md px-2 py-1.5">{body}</div>;
  }
  return (
    <Link
      href={href}
      className="block rounded-md px-2 py-1.5 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {body}
    </Link>
  );
}
