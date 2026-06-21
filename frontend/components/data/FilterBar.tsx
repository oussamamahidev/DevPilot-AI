import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  title?: string;
};

export function FilterBar({ children, title = "Filters" }: FilterBarProps) {
  return (
    <section className="mb-5 rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <p className="text-sm font-medium text-fg">{title}</p>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end">
          {children}
        </div>
      </div>
    </section>
  );
}
