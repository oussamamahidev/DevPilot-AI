"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/ragops", label: "RAGOps" },
  { href: "/admin/rag-traces", label: "RAG Traces" },
  { href: "/admin/quality", label: "Quality" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

export function AdminShell({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  const pathname = usePathname();
  const { user } = useAdminAccess();

  return (
    <DashboardShell activeItem="admin" title={title} description={description}>
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex flex-wrap gap-2">
          {adminLinks.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "whitespace-nowrap border-b-2 border-slate-950 px-3 py-3 text-sm font-medium text-slate-950"
                    : "whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-950"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {user ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{user.email}</span>
          <RoleBadge role={user.role} />
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}

export function AdminAccessMessage({
  label,
  title,
}: {
  label: string;
  title: string;
}) {
  return (
    <AdminShell title={title} description="Administrative access is required.">
      <section className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        {label}
      </section>
    </AdminShell>
  );
}

export function MetricCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-slate-950 sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </section>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const classes =
    role === "super_admin"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : role === "admin"
        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${classes}`}>
      {role.replace("_", " ")}
    </span>
  );
}

export function StatusBadge({
  deletedAt,
  isActive,
  status,
}: {
  deletedAt?: string | null;
  isActive?: boolean;
  status?: string;
}) {
  const label = status ?? (deletedAt ? "deleted" : isActive ? "active" : "inactive");
  const classes =
    label === "active" || label === "indexed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : label === "deleted" || label === "failed"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

export function HealthBadge({ status }: { status: string }) {
  const classes =
    status === "healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "critical"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
      {label}
    </section>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Toolbar({
  children,
  search,
  setSearch,
}: {
  children?: ReactNode;
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search"
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 md:max-w-sm"
      />
      <div className="flex w-full flex-wrap gap-2 md:w-auto">{children}</div>
    </div>
  );
}

export function PaginationControls({
  canNext,
  canPrevious,
  page,
  setPage,
}: {
  canNext: boolean;
  canPrevious: boolean;
  page: number;
  setPage: (value: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 sm:justify-end">
      <button
        type="button"
        disabled={!canPrevious}
        onClick={() => setPage(page - 1)}
        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        Previous
      </button>
      <span className="text-sm text-slate-500">Page {page + 1}</span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => setPage(page + 1)}
        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        Next
      </button>
    </div>
  );
}

export function ConfirmReasonModal({
  actionLabel,
  confirmLabel,
  error,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  requireConfirmText = false,
}: {
  actionLabel: string;
  confirmLabel: string;
  error: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  requireConfirmText?: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const canSubmit =
    !isSubmitting &&
    reason.trim().length >= 3 &&
    (!requireConfirmText || confirmText.trim() === "CONFIRM");

  useEffect(() => {
    if (isOpen) {
      setConfirmText("");
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <section className="w-full max-w-lg rounded-md border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-950">{actionLabel}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A reason is required and will be written to the audit log.
        </p>
        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <textarea
          className="mt-4 min-h-28 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-slate-500"
          placeholder="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {requireConfirmText ? (
          <input
            className="mt-3 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            placeholder="Type CONFIRM"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
          />
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(reason)}
            className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {isSubmitting ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${formatDecimal(value / 1024, 1)} KB`;
  }
  return `${formatDecimal(value / (1024 * 1024), 1)} MB`;
}
