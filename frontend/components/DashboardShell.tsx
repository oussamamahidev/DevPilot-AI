"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

type DashboardShellProps = {
  activeItem?: "dashboard" | "workspaces" | "documents" | "chat" | "admin" | "settings";
  title: string;
  description?: string;
  workspaceId?: string;
  children: ReactNode;
};

/**
 * Thin adapter over the new AppShell foundation. Existing pages keep their
 * `activeItem` / `workspaceId` props (now derived from the route + workspace
 * context inside AppShell), so no page changes are required.
 */
export function DashboardShell({ title, description, children }: DashboardShellProps) {
  return (
    <AppShell title={title} description={description}>
      {children}
    </AppShell>
  );
}
