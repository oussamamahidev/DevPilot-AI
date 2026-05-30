"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ConfirmReasonModal,
  ErrorBanner,
  formatDate,
  formatNumber,
  PaginationControls,
  RoleBadge,
  StatusBadge,
  Toolbar,
} from "@/components/admin/AdminUI";
import { Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  deactivateAdminUser,
  deleteAdminUser,
  listAdminUsers,
  reactivateAdminUser,
  updateAdminUserRole,
} from "@/lib/admin";
import type { AdminUserDetail, AdminUserSummary } from "@/types";

const PAGE_SIZE = 10;
type PendingAction =
  | { type: "role"; user: AdminUserSummary; nextRole: "user" | "admin" }
  | { type: "deactivate"; user: AdminUserSummary }
  | { type: "reactivate"; user: AdminUserSummary }
  | { type: "delete"; user: AdminUserSummary }
  | null;

export default function AdminUsersPage() {
  const { isAdmin, isLoading, isSuperAdmin, user: actor } = useAdminAccess();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const load = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const response = await listAdminUsers({ page: 1, page_size: 100 });
      setUsers(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load users.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.full_name.toLowerCase().includes(normalizedSearch);
      const userStatus = user.deleted_at ? "deleted" : user.is_active ? "active" : "inactive";
      return (
        matchesSearch &&
        (!role || user.role === role) &&
        (!status || userStatus === status)
      );
    });
  }, [role, search, status, users]);

  const visibleUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [role, search, status]);

  function applyUpdatedUser(updatedUser: AdminUserDetail) {
    setUsers((current) =>
      current.map((user) =>
        user.id === updatedUser.id
          ? {
              ...user,
              deleted_at: updatedUser.deleted_at,
              deactivated_at: updatedUser.deactivated_at,
              document_count: updatedUser.document_count,
              email: updatedUser.email,
              full_name: updatedUser.full_name,
              is_active: updatedUser.is_active,
              last_login_at: updatedUser.last_login_at,
              role: updatedUser.role,
              workspace_count: updatedUser.workspace_count,
            }
          : user,
      ),
    );
  }

  async function submitAction(reason: string) {
    if (!pendingAction) {
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const updatedUser =
        pendingAction.type === "role"
          ? await updateAdminUserRole(
              pendingAction.user.id,
              pendingAction.nextRole,
              reason,
            )
          : pendingAction.type === "deactivate"
            ? await deactivateAdminUser(pendingAction.user.id, reason)
            : pendingAction.type === "reactivate"
              ? await reactivateAdminUser(pendingAction.user.id, reason)
              : await deleteAdminUser(pendingAction.user.id, reason);

      applyUpdatedUser(updatedUser);
      setPendingAction(null);
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function canManageUser(user: AdminUserSummary) {
    if (actor?.id === user.id) {
      return false;
    }
    return isSuperAdmin || user.role === "user";
  }

  if (isLoading) {
    return <AdminAccessMessage title="Users" label="Checking admin access." />;
  }

  if (!isAdmin) {
    return <AdminAccessMessage title="Users" label="Admin access required." />;
  }

  return (
    <AdminShell title="Users" description="Manage global user access and roles.">
      <ErrorBanner message={error} onRetry={() => void load()} />
      <Toolbar search={search} setSearch={setSearch}>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
        </select>
      </Toolbar>

      <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-fg">User Directory</h2>
          <span className="text-sm text-fg-subtle">
            {formatNumber(filteredUsers.length)} users
          </span>
        </div>

        {isFetching ? <LoadingSkeleton label="Loading users" rows={4} /> : null}

        {!isFetching && visibleUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try changing the search, role, or status filters."
          />
        ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead className="bg-sunken text-xs uppercase text-fg-subtle">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">User</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Role</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspaces</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Last Login</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-3">
                    <div className="break-words font-medium text-fg">{user.full_name}</div>
                    <div className="break-all text-xs text-fg-subtle">{user.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge isActive={user.is_active} deletedAt={user.deleted_at} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                    {formatNumber(user.workspace_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-subtle">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover"
                      >
                        View
                      </Link>
                      {canManageUser(user) && !user.deleted_at ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setPendingAction({
                              nextRole: user.role === "user" ? "admin" : "user",
                              type: "role",
                              user,
                            })
                          }
                        >
                          {user.role === "user" ? "Make admin" : "Make user"}
                        </Button>
                      ) : null}
                      {canManageUser(user) && !user.deleted_at ? (
                        user.is_active ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setPendingAction({ type: "deactivate", user })}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setPendingAction({ type: "reactivate", user })}
                          >
                            Reactivate
                          </Button>
                        )
                      ) : null}
                      {canManageUser(user) && !user.deleted_at ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setPendingAction({ type: "delete", user })}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <PaginationControls
          page={page}
          setPage={setPage}
          canPrevious={page > 0}
          canNext={(page + 1) * PAGE_SIZE < filteredUsers.length}
        />
      </section>
      <ConfirmReasonModal
        isOpen={pendingAction !== null}
        actionLabel={
          pendingAction?.type === "role"
            ? `Change role for ${pendingAction.user.email}`
            : pendingAction?.type === "deactivate"
              ? `Deactivate ${pendingAction.user.email}`
              : pendingAction?.type === "reactivate"
                ? `Reactivate ${pendingAction.user.email}`
                : pendingAction?.type === "delete"
                  ? `Delete ${pendingAction.user.email}`
                  : "Confirm user action"
        }
        confirmLabel={pendingAction?.type === "delete" ? "Delete" : "Confirm"}
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText={pendingAction?.type === "delete"}
        onClose={() => {
          setPendingAction(null);
          setModalError(null);
        }}
        onConfirm={submitAction}
      />
    </AdminShell>
  );
}
