import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

type CardHeaderProps = {
  action?: ReactNode;
  description?: string;
  title: string;
};

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <section
      {...props}
      className={`min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ action, description, title }: CardHeaderProps) {
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words text-base font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}
