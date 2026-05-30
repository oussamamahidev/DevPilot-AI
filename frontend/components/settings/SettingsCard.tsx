import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { StatusTone } from "@/components/ui/StatusBadge";

type SettingsCardProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  title: string;
  tone?: "default" | "danger";
};

type SettingsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "emerald" | "red" | "slate" | "gemini" | "ollama" | "openai";
};

type FieldRowProps = {
  label: string;
  value: ReactNode;
};

// Map the settings-local provider tones onto the unified Badge tone system.
const providerToneMap: Record<NonNullable<StatusBadgeProps["tone"]>, StatusTone> = {
  emerald: "success",
  gemini: "ai",
  ollama: "info",
  openai: "success",
  red: "critical",
  slate: "neutral",
};

export function SettingsCard({
  action,
  children,
  className,
  description,
  title,
  tone = "default",
}: SettingsCardProps) {
  const toneClass =
    tone === "danger" ? "border-danger-line bg-danger-subtle" : "border-line bg-surface";

  return (
    <section
      className={[
        "min-w-0 overflow-hidden rounded-lg border p-5 shadow-sm",
        toneClass,
        className ?? "",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-fg-muted">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:shrink-0">{action}</div>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SettingsButton({
  children,
  className,
  disabled,
  variant = "secondary",
  ...props
}: SettingsButtonProps) {
  return (
    <Button variant={variant} size="sm" disabled={disabled} className={className} {...props}>
      {children}
    </Button>
  );
}

export function StatusBadge({ children, tone = "slate" }: StatusBadgeProps) {
  return <Badge tone={providerToneMap[tone]}>{children}</Badge>;
}

export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="grid gap-1 border-t border-line-subtle py-3 text-sm sm:grid-cols-3 sm:gap-4">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-fg sm:col-span-2">{value}</dd>
    </div>
  );
}

export function CardError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger-line bg-danger-subtle px-4 py-3 text-sm text-danger-surface-fg">
      {message}
    </div>
  );
}

export function CardNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-sunken px-4 py-3 text-sm leading-6 text-fg-muted">
      {children}
    </div>
  );
}
