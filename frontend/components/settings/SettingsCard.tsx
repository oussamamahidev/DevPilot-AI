import type { ButtonHTMLAttributes, ReactNode } from "react";

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

export function SettingsCard({
  action,
  children,
  className,
  description,
  title,
  tone = "default",
}: SettingsCardProps) {
  const toneClass =
    tone === "danger" ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white";

  return (
    <section
      className={[
        "min-w-0 overflow-hidden rounded-md border p-5 shadow-sm",
        toneClass,
        className ?? "",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:shrink-0">{action}</div> : null}
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
  const variantClass =
    variant === "primary"
      ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
      : variant === "danger"
        ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100";

  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        "h-9 rounded-md border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400",
        variantClass,
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ children, tone = "slate" }: StatusBadgeProps) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "red"
        ? "bg-red-100 text-red-800"
        : tone === "gemini"
          ? "bg-indigo-100 text-indigo-800"
          : tone === "ollama"
            ? "bg-teal-100 text-teal-800"
            : tone === "openai"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-700";

  return (
    <span
      className={[
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-medium",
        toneClass,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="grid gap-1 border-t border-slate-100 py-3 text-sm sm:grid-cols-3 sm:gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-slate-950 sm:col-span-2">{value}</dd>
    </div>
  );
}

export function CardError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function CardNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
      {children}
    </div>
  );
}
