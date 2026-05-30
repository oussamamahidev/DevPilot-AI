import type { ReactNode } from "react";

type EmptyStateProps = {
  action?: ReactNode;
  description?: string;
  icon?: ReactNode;
  title: string;
};

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-line bg-surface p-6 text-center">
      {icon ? <div className="mx-auto mb-3 text-fg-subtle">{icon}</div> : null}
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}
