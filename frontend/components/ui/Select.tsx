import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string | null;
  label?: string;
};

export function Select({ children, className = "", error, id, label, ...props }: SelectProps) {
  const inputId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label ? <span>{label}</span> : null}
      <select
        {...props}
        id={inputId}
        className={`h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 ${className}`}
      >
        {children}
      </select>
      {error ? <span className="text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}
