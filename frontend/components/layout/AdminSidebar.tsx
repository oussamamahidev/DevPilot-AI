"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";

export const adminNavigationItems = [
  { href: "/admin", id: "overview", label: "Overview" },
  { href: "/admin/ragops", id: "ragops", label: "RAGOps" },
  { href: "/admin/rag-traces", id: "rag-traces", label: "RAG Traces" },
  { href: "/admin/quality", id: "quality", label: "Quality" },
  { href: "/admin/users", id: "users", label: "Users" },
  { href: "/admin/workspaces", id: "workspaces", label: "Workspaces" },
  { href: "/admin/documents", id: "documents", label: "Documents" },
  { href: "/admin/audit-logs", id: "audit-logs", label: "Audit Logs" },
] as const;

function activeAdminId(pathname: string | null) {
  const match = [...adminNavigationItems]
    .reverse()
    .find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`));
  return match?.id ?? "overview";
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = activeAdminId(pathname);

  return (
    <div className="mb-6">
      <label className="block md:hidden">
        <span className="mb-2 block text-xs font-semibold uppercase text-slate-500">
          Admin section
        </span>
        <select
          value={activeId}
          onChange={(event) => {
            const next = adminNavigationItems.find((item) => item.id === event.target.value);
            if (next) {
              router.push(next.href);
            }
          }}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
        >
          {adminNavigationItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden md:block">
        <Tabs
          activeId={activeId}
          items={adminNavigationItems.map((item) => ({ id: item.id, label: item.label }))}
          onChange={(id) => {
            const next = adminNavigationItems.find((item) => item.id === id);
            if (next) {
              router.push(next.href);
            }
          }}
        />
      </div>
    </div>
  );
}
