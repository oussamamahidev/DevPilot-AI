"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AdminAccessMessage,
  AdminShell,
  ConfirmReasonModal,
  ErrorBanner,
  formatDate,
  formatNumber,
  RoleBadge,
  StatusBadge,
} from "@/components/admin/AdminUI";
import { Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  deactivateAdminUser,
  deleteAdminUser,
  getAdminUser,
  reactivateAdminUser,
  updateAdminUserRole,
} from "@/lib/admin";
import type { AdminUserDetail } from "@/types";

type PendingAction = "role" | "deactivate" | "reactivate" | "delete" | null;

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const { isAdmin, isLoading, isSuperAdmin, user: actor } = useAdminAccess();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [role, setRole] = useState("user");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userId = params.id;

  const load = useCallback(async () => {
    if (!isAdmin || !userId) {
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const data = await getAdminUser(userId);
      setUser(data);
      setRole(data.role);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load user.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(reason: string) {
    if (!user || !pendingAction) {
      return;
    }
    if (reason.trim().length < 3) {
      setModalError("Enter a reason with at least 3 characters.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const updatedUser =
        pendingAction === "role"
          ? await updateAdminUserRole(user.id, role, reason)
          : pendingAction === "deactivate"
            ? await deactivateAdminUser(user.id, reason)
            : pendingAction === "reactivate"
              ? await reactivateAdminUser(user.id, reason)
              : await deleteAdminUser(user.id, reason);
      setUser(updatedUser);
      setRole(updatedUser.role);
      setPendingAction(null);
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <AdminAccessMessage title="User Detail" label="Checking admin access." />;
  }

  if (!isAdmin) {
    return <AdminAccessMessage title="User Detail" label="Admin access required." />;
  }

  const isSelf = actor?.id === user?.id;
  const canChangeRole = Boolean(user && !isSelf && (isSuperAdmin || user.role === "user"));
  const canManageLifecycle = Boolean(user && (isSuperAdmin || user.role === "user"));

  return (
    <AdminShell title="User Detail" description="Inspect user access and manage lifecycle state.">
      <ErrorBanner message={error} onRetry={() => void load()} />
      {isFetching && !user ? (
        <LoadingSkeleton label="Loading user" rows={3} />
      ) : null}

      {user ? (
        <div className="grid gap-6">
          <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-950">{user.full_name}</h2>
                <p className="mt-1 break-all text-sm text-slate-600">{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <RoleBadge role={user.role} />
                <StatusBadge isActive={user.is_active} deletedAt={user.deleted_at} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <Info label="Workspaces" value={formatNumber(user.workspace_count)} />
              <Info label="Owned Workspaces" value={formatNumber(user.owned_workspace_count)} />
              <Info label="Documents" value={formatNumber(user.document_count)} />
              <Info label="Conversations" value={formatNumber(user.conversation_count)} />
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Access Control</h2>
            <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-3">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={!canChangeRole}
                className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                {isSuperAdmin ? <option value="super_admin">Super admin</option> : null}
              </select>
              <div className="flex min-w-0 flex-wrap gap-2 md:col-span-2">
                <Button
                  type="button"
                  disabled={
                    role === user.role ||
                    !canChangeRole ||
                    (role === "super_admin" && !isSuperAdmin)
                  }
                  onClick={() => setPendingAction("role")}
                >
                  Update Role
                </Button>
                {user.is_active ? (
                  <Button
                    type="button"
                    disabled={isSelf || !canManageLifecycle}
                    onClick={() => setPendingAction("deactivate")}
                    variant="secondary"
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={!canManageLifecycle}
                    onClick={() => setPendingAction("reactivate")}
                    variant="secondary"
                  >
                    Reactivate
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={isSelf || !canManageLifecycle}
                  onClick={() => setPendingAction("delete")}
                  variant="danger"
                >
                  Delete
                </Button>
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Lifecycle</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Info label="Created" value={formatDate(user.created_at)} />
              <Info label="Last Login" value={formatDate(user.last_login_at)} />
              <Info label="Deactivated" value={formatDate(user.deactivated_at)} />
            </div>
          </section>
        </div>
      ) : !isFetching && !error ? (
        <EmptyState
          title="User not found"
          description="This user may have been deleted or the identifier is invalid."
        />
      ) : null}

      <ConfirmReasonModal
        isOpen={pendingAction !== null}
        actionLabel="Confirm user change"
        confirmLabel="Confirm"
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText={pendingAction === "delete"}
        onClose={() => {
          setPendingAction(null);
          setModalError(null);
        }}
        onConfirm={submit}
      />
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}
