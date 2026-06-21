import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  containerClassName?: string;
  error?: string | null;
  label?: string;
};

export function Input({
  className = "",
  containerClassName = "",
  error,
  id,
  label,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <label className={`grid min-w-0 gap-2 text-sm font-medium text-fg ${containerClassName}`}>
      {label ? <span>{label}</span> : null}
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-10 min-w-0 rounded-md border bg-surface px-3 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-danger" : "border-line focus:border-line-strong"} ${className}`}
      />
      {error ? (
        <span id={errorId} className="text-xs font-medium text-danger-fg">
          {error}
        </span>
      ) : null}
    </label>
  );
}
