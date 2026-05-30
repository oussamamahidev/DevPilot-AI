import type { ReactNode } from "react";

type ErrorStateProps = {
  action?: ReactNode;
  message: string | null | undefined;
  title?: string;
};

export function ErrorState({ action, message, title = "Something went wrong" }: ErrorStateProps) {
  if (!message) {
    return null;
  }

  return (
    <section
      role="alert"
      className="rounded-lg border border-danger-line bg-danger-subtle px-4 py-3 text-sm text-danger-surface-fg"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 leading-5">{message}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
