import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { StatusTone } from "@/components/ui/StatusBadge";

type NotificationProps = {
  action?: ReactNode;
  message: string;
  title?: string;
  tone?: StatusTone;
};

export function Notification({
  action,
  message,
  title = "Notification",
  tone = "info",
}: NotificationProps) {
  return (
    <section role="status" className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={tone}>{title}</Badge>
          <p className="mt-3 text-sm leading-6 text-fg-muted">{message}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export const Toast = Notification;
