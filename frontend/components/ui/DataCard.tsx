import type { HTMLAttributes, ReactNode } from "react";
import { toneClasses, type StatusTone } from "@/components/ui/StatusBadge";

type DataCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** Header title. Omit for a header-less container. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Leading icon node (e.g. <Icon name="…" />). Toned via `tone`. */
  icon?: ReactNode;
  /** Right-aligned header slot — actions, filters, menus. */
  actions?: ReactNode;
  /** Optional count chip next to the title (e.g. "128 traces"). */
  count?: number;
  countLabel?: string;
  /** Accent applied to the icon badge and (when set) a left border rule. */
  tone?: StatusTone;
  accentBorder?: boolean;
  footer?: ReactNode;
  /** Pad the body (default true). Set false for flush tables/lists. */
  padded?: boolean;
  bodyClassName?: string;
  children: ReactNode;
};

const accentRule: Record<StatusTone, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  critical: "border-l-danger",
  info: "border-l-info",
  ai: "border-l-brand",
  neutral: "border-l-line-strong",
};

/**
 * The canonical titled container. Unifies the historical Card+CardHeader,
 * Panel, Section, SectionCard, DataSection and SettingsCard patterns.
 */
export function DataCard({
  title,
  subtitle,
  icon,
  actions,
  count,
  countLabel,
  tone = "neutral",
  accentBorder = false,
  footer,
  padded = true,
  bodyClassName = "",
  children,
  className = "",
  ...rest
}: DataCardProps) {
  const hasHeader = Boolean(title || actions || icon);

  return (
    <section
      {...rest}
      className={`min-w-0 overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-sm ${
        accentBorder ? `border-l-4 ${accentRule[tone]}` : ""
      } ${className}`}
    >
      {hasHeader ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${toneClasses[tone]}`}
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-fg">{title}</h3>
                  {count !== undefined ? (
                    <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-xs font-medium tabular-nums text-fg-muted">
                      {new Intl.NumberFormat("en-US").format(count)}
                      {countLabel ? ` ${countLabel}` : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {subtitle ? <p className="mt-0.5 truncate text-xs text-fg-subtle">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div className={`${padded ? "p-4" : ""} ${bodyClassName}`}>{children}</div>

      {footer ? <div className="border-t border-line bg-sunken/50 px-4 py-3">{footer}</div> : null}
    </section>
  );
}
