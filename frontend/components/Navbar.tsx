"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdmin } from "@/lib/permissions";

const protectedNavigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/chat", label: "Chat" },
  { href: "/settings", label: "Settings" },
];

const activeLinkClass = "shrink-0 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white";
const inactiveLinkClass =
  "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-hover hover:text-fg";

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  const linkClass = (href: string, exact = false) =>
    (exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`))
      ? activeLinkClass
      : inactiveLinkClass;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand text-sm font-semibold text-white">
            DP
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-fg">DevPilot AI</span>
            <span className="block text-xs text-fg-subtle">Document intelligence</span>
          </span>
        </Link>

        <nav className="flex w-full max-w-full flex-wrap items-center gap-1 lg:w-auto">
          {isLoading ? (
            <span className="rounded-md bg-sunken px-3 py-2 text-sm font-medium text-fg-muted">
              Checking session...
            </span>
          ) : isAuthenticated && user ? (
            <>
              {protectedNavigationItems.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
              {canAccessAdmin(user) ? (
                <Link href="/admin" className={linkClass("/admin")}>
                  Admin
                </Link>
              ) : null}
              <span className="flex max-w-[220px] shrink-0 items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-fg-muted sm:max-w-xs lg:ml-2">
                <span className="min-w-0 max-w-32 truncate sm:max-w-40">
                  {user.full_name || user.email}
                </span>
                <RoleBadge role={user.role} />
              </span>
              <Button onClick={logout} size="sm" variant="secondary">
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass("/login", true)}>
                Login
              </Link>
              <Link
                href="/register"
                className={
                  pathname === "/register"
                    ? activeLinkClass
                    : "shrink-0 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-fg transition hover:bg-hover"
                }
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
