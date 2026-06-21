import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  containerClassName?: string;
  error?: string | null;
  label?: string;
};

export function Textarea({
  className = "",
  containerClassName = "",
  error,
  id,
  label,
  ...props
}: TextareaProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <label className={`grid min-w-0 gap-2 text-sm font-medium text-fg ${containerClassName}`}>
      {label ? <span>{label}</span> : null}
      <textarea
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`min-h-28 min-w-0 rounded-md border bg-surface px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-danger" : "border-line focus:border-line-strong"} ${className}`}
      />
      {error ? (
        <span id={errorId} className="text-xs font-medium text-danger-fg">
          {error}
        </span>
      ) : null}
    </label>
  );
}
