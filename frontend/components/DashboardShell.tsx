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
      <PageContainer className="flex min-w-0 flex-col gap-4 py-4 sm:gap-6 sm:py-6 lg:flex-row lg:items-start">
        <div className="w-full min-w-0 lg:w-52 lg:shrink-0">
          <Sidebar activeKey={activeItem} items={shellNavigation} />
        </div>
        <main className="w-full min-w-0 flex-1">
          <PageHeader title={title} description={description} />
          {children}
        </main>
      </PageContainer>
    </AppLayout>
  );
}
