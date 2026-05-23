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

  return (
    <label className={`grid min-w-0 gap-2 text-sm font-medium text-slate-700 ${containerClassName}`}>
      {label ? <span>{label}</span> : null}
      <input
        {...props}
        id={inputId}
        className={`h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 ${className}`}
      />
      {error ? <span className="text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}
