"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";

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
  const shellNavigation = [
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
    ...(user?.role === "admin" || user?.role === "super_admin"
      ? [{ href: "/admin", key: "admin", label: "Admin" }]
      : []),
    { href: "/settings", key: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit lg:overflow-visible">
          <nav className="flex min-w-max gap-1 lg:grid lg:min-w-0">
            {shellNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.key === activeItem
                    ? "whitespace-nowrap rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                    : "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="w-full min-w-0">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
