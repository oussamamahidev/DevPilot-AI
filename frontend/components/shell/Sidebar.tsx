"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { WorkspaceSwitcher } from "@/components/shell/WorkspaceSwitcher";
import { adminNav, mainNav, type NavItem } from "@/lib/navigation";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdmin } from "@/lib/permissions";

const EXACT_MATCH = new Set(["/dashboard", "/admin"]);

function isActive(pathname: string, href: string) {
  if (EXACT_MATCH.has(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const showAdmin = canAccessAdmin(user);

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          collapsed ? "justify-center" : ""
        } ${active ? "bg-brand-subtle text-brand-fg" : "text-fg-muted hover:bg-hover hover:text-fg"}`}
      >
        <Icon name={item.icon} size={18} className="shrink-0" />
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      </Link>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <WorkspaceSwitcher collapsed={collapsed} />
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pt-1">
        {mainNav.map(renderItem)}
        {showAdmin ? (
          <>
            <p
              className={`mt-4 px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle ${
                collapsed ? "sr-only" : ""
              }`}
            >
              Admin
            </p>
            {adminNav.map(renderItem)}
          </>
        ) : null}
      </nav>
    </div>
  );
}
