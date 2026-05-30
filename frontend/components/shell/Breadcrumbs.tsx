"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { buildBreadcrumbs } from "@/lib/navigation";
import { useWorkspaces } from "@/providers/WorkspaceProvider";

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const { activeWorkspace } = useWorkspaces();
  const crumbs = buildBreadcrumbs(pathname, { workspaceName: activeWorkspace?.name });

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center">
      <ol className="flex min-w-0 items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li
              key={`${crumb.label}-${index}`}
              className={`min-w-0 items-center gap-1 ${isLast ? "flex" : "hidden md:flex"}`}
            >
              {index > 0 ? (
                <Icon name="chevronRight" size={14} className="shrink-0 text-fg-subtle" />
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="max-w-[10rem] truncate rounded text-sm text-fg-muted transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="max-w-[14rem] truncate text-sm font-medium text-fg"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
