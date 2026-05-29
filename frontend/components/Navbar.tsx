"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdmin } from "@/lib/permissions";

const protectedNavigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/chat", label: "Chat" },
  { href: "/settings", label: "Settings" },
];

function roleBadgeClass(role: string) {
  if (role === "super_admin") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (role === "admin") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
            DP
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-950">
              DevPilot AI
            </span>
            <span className="block text-xs text-slate-500">
              Document intelligence
            </span>
          </span>
        </Link>

        <nav className="flex w-full max-w-full flex-wrap items-center gap-1 lg:w-auto">
          {isLoading ? (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">
              Checking session...
            </span>
          ) : isAuthenticated && user ? (
            <>
              {protectedNavigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    pathname === item.href || pathname?.startsWith(`${item.href}/`)
                      ? "shrink-0 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                      : "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }
                >
                  {item.label}
                </Link>
              ))}
              {canAccessAdmin(user) ? (
                <Link
                  href="/admin"
                  className={
                    pathname === "/admin" || pathname?.startsWith("/admin/")
                      ? "shrink-0 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                      : "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }
                >
                  Admin
                </Link>
              ) : null}
              <span className="ml-0 flex max-w-[220px] shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:max-w-xs lg:ml-2">
                <span className="min-w-0 max-w-32 truncate sm:max-w-40">{user.full_name || user.email}</span>
                <span
                  className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${roleBadgeClass(
                    user.role,
                  )}`}
                >
                  {user.role.replace("_", " ")}
                </span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={
                  pathname === "/login"
                    ? "shrink-0 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                    : "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }
              >
                Login
              </Link>
              <Link
                href="/register"
                className={
                  pathname === "/register"
                    ? "shrink-0 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                    : "shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
