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
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={tone}>{title}</Badge>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export const Toast = Notification;
