"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/ui/Dropdown";
import { Icon } from "@/components/ui/Icon";
import { iconButtonClass } from "@/components/shell/styles";
import { useNotifications } from "@/providers/NotificationsProvider";

function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationCenter() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  return (
    <Dropdown
      align="end"
      panelClassName="w-[min(22rem,calc(100vw-1.5rem))] p-0"
      trigger={({ toggle, ref, triggerProps }) => (
        <button
          ref={ref}
          onClick={toggle}
          {...triggerProps}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          className={`relative ${iconButtonClass}`}
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex max-h-[min(28rem,calc(100vh-5rem))] flex-col">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            <button
              type="button"
              onClick={markAllRead}
              className="rounded text-xs font-medium text-brand-fg transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Mark all read
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {notifications.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-sm font-medium text-fg">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-fg-subtle">New activity will appear here.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    markRead(item.id);
                    if (item.href) {
                      router.push(item.href);
                    }
                    close();
                  }}
                  className="flex w-full gap-2.5 rounded-md px-2.5 py-2 text-left transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="mt-1.5 shrink-0">
                    <span
                      className={`block h-2 w-2 rounded-full ${item.read ? "bg-transparent" : "bg-brand"}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-fg">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-fg-subtle">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 block line-clamp-2 text-xs text-fg-muted">
                        {item.body}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
