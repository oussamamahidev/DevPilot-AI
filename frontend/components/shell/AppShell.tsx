"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { iconButtonClass } from "@/components/shell/styles";

const COLLAPSE_KEY = "dp-sidebar-collapsed";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  eyebrow?: string;
};

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand text-sm font-bold text-white">
        DP
      </span>
      {!collapsed ? <span className="truncate text-sm font-semibold text-fg">DevPilot AI</span> : null}
    </Link>
  );
}

export function AppShell({ children, title, description, eyebrow }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-fg">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-surface lg:flex ${
          collapsed ? "lg:w-16" : "lg:w-64"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-line px-3">
          <Brand collapsed={collapsed} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Sidebar collapsed={collapsed} />
        </div>
        <div className="shrink-0 border-t border-line p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Icon name="panelLeft" size={18} className="shrink-0" />
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[1100] lg:hidden">
          <div className="absolute inset-0 animate-dp-fade-in bg-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3">
              <Brand collapsed={false} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className={iconButtonClass}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            {title ? <PageHeader title={title} description={description} eyebrow={eyebrow} /> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
