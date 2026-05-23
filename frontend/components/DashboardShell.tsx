"use client";

import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Sidebar, type SidebarItem } from "@/components/layout/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdmin } from "@/lib/permissions";

type DashboardShellProps = {
  activeItem?: "dashboard" | "workspaces" | "documents" | "chat" | "admin" | "settings";
  title: string;
  description?: string;
  workspaceId?: string;
  children: ReactNode;
};

export function DashboardShell({
  activeItem,
  title,
  description,
  workspaceId,
  children,
}: DashboardShellProps) {
  const { user } = useAuth();
  const shellNavigation: SidebarItem[] = [
    { href: "/dashboard", key: "dashboard", label: "Dashboard" },
    { href: "/dashboard#workspaces", key: "workspaces", label: "Workspaces" },
    {
      href: workspaceId ? `/workspaces/${workspaceId}/documents` : "/documents",
      key: "documents",
      label: "Documents",
    },
    {
      href: workspaceId ? `/workspaces/${workspaceId}/chat` : "/chat",
      key: "chat",
      label: "Chat",
    },
    ...(canAccessAdmin(user) ? [{ href: "/admin", key: "admin", label: "Admin" }] : []),
    { href: "/settings", key: "settings", label: "Settings" },
  ];

  return (
    <AppLayout>
      <PageContainer className="grid min-w-0 gap-4 py-4 sm:gap-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Sidebar activeKey={activeItem} items={shellNavigation} />
        <main className="w-full min-w-0">
          <PageHeader title={title} description={description} />
          {children}
        </main>
      </PageContainer>
    </AppLayout>
  );
}
