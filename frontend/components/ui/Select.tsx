import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  containerClassName?: string;
  error?: string | null;
  label?: string;
};

export function Select({
  children,
  className = "",
  containerClassName = "",
  error,
  id,
  label,
  ...props
}: SelectProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <label className={`grid min-w-0 gap-2 text-sm font-medium text-fg ${containerClassName}`}>
      {label ? <span>{label}</span> : null}
      <select
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-10 min-w-0 rounded-md border bg-surface px-3 text-sm text-fg outline-none transition focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-danger" : "border-line focus:border-line-strong"} ${className}`}
      >
        {children}
      </select>
      {error ? (
        <span id={errorId} className="text-xs font-medium text-danger-fg">
          {error}
        </span>
      ) : null}
    </label>
  );
}
