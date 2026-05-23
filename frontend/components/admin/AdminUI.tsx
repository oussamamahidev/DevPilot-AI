"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/Button";
import { EmptyState as BaseEmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { MetricCard as BaseMetricCard } from "@/components/ui/MetricCard";
import { RoleBadge as BaseRoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge as BaseStatusBadge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useAdminAccess } from "@/hooks/useAdminAccess";

export function AdminShell({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  const { user } = useAdminAccess();

  return (
    <DashboardShell activeItem="admin" title={title} description={description}>
      <AdminSidebar />
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
  const { error } = useAdminAccess();
  const isChecking = /checking/i.test(label);

  return (
    <AdminShell title={title} description="Administrative access is required.">
      {isChecking ? (
        <LoadingSkeleton label={label} rows={3} />
      ) : error ? (
        <ErrorState
          action={
            <Button onClick={() => window.location.reload()} size="sm" variant="secondary">
              Retry
            </Button>
          }
          message={error}
          title="Unable to verify admin access"
        />
      ) : (
        <BaseEmptyState
          description="Administrative tools are restricted to admin and super admin accounts."
          title="You do not have permission to access this page."
        />
      )}
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
  return <BaseMetricCard detail={detail} label={label} value={value} />;
}

export function RoleBadge({ role }: { role: string }) {
  return <BaseRoleBadge role={role} />;
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
  return <BaseStatusBadge status={label} />;
}

export function HealthBadge({ status }: { status: string }) {
  return <BaseStatusBadge status={status} />;
}

export function EmptyState({ label }: { label: string }) {
  return <BaseEmptyState title={label} />;
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry?: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-6">
      <ErrorState
        action={
          onRetry ? (
            <Button onClick={onRetry} size="sm" variant="secondary">
              Retry
            </Button>
          ) : undefined
        }
        message={message}
      />
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
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search"
        containerClassName="md:max-w-sm"
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
      <Button
        disabled={!canPrevious}
        onClick={() => setPage(page - 1)}
        size="sm"
        variant="secondary"
      >
        Previous
      </Button>
      <span className="text-sm text-slate-500">Page {page + 1}</span>
      <Button
        disabled={!canNext}
        onClick={() => setPage(page + 1)}
        size="sm"
        variant="secondary"
      >
        Next
      </Button>
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={actionLabel}
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onClick={() => onConfirm(reason)}
            variant="danger"
          >
            {isSubmitting ? "Working..." : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-slate-600">
        A reason is required and will be written to the audit log.
      </p>
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
      <Textarea
        className="mt-4"
        placeholder="Reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {requireConfirmText ? (
        <Input
          className="mt-3"
          placeholder="Type CONFIRM"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
        />
      ) : null}
    </Modal>
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
