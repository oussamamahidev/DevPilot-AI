"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StatusTone } from "@/components/ui/StatusBadge";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  tone?: StatusTone;
  href?: string;
  createdAt: number;
  read: boolean;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  push: (input: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const MINUTE = 60_000;
const seed: AppNotification[] = [
  {
    id: "seed-welcome",
    title: "Welcome to DevPilot AI",
    body: "Your workspace is ready — upload a document to start asking questions.",
    tone: "ai",
    createdAt: Date.now() - 4 * MINUTE,
    read: false,
  },
  {
    id: "seed-indexed",
    title: "Document indexed",
    body: '"handbook.pdf" finished processing and is ready for chat.',
    tone: "success",
    href: "/documents",
    createdAt: Date.now() - 26 * MINUTE,
    read: false,
  },
  {
    id: "seed-quality",
    title: "Answer flagged for review",
    body: "A recent answer scored low on faithfulness.",
    tone: "warning",
    href: "/admin/rag-traces",
    createdAt: Date.now() - 3 * 60 * MINUTE,
    read: true,
  },
];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(seed);

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((input: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications((current) => [
      {
        ...input,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        read: false,
      },
      ...current,
    ]);
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const value = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead, dismiss, push }),
    [notifications, unreadCount, markRead, markAllRead, dismiss, push],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
