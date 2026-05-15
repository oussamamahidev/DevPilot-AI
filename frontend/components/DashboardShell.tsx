import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

type DashboardShellProps = {
  activeItem?: "dashboard" | "workspaces" | "documents" | "chat" | "settings";
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
    { href: "/settings", key: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-md border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <nav className="grid gap-1">
            {shellNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.key === activeItem
                    ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                    : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
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
