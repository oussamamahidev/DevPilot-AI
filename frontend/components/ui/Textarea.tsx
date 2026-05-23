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

  return (
    <label className={`grid min-w-0 gap-2 text-sm font-medium text-slate-700 ${containerClassName}`}>
      {label ? <span>{label}</span> : null}
      <textarea
        {...props}
        id={inputId}
        className={`min-h-28 min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 ${className}`}
      />
      {error ? <span className="text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}
