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
} from "@/components/admin/AdminUI";
import {
  BulkBar,
  BulkButton,
  Check,
  DataSection,
  exportToCsv,
  FilterPills,
  MetricStrip,
  Pager,
  SearchBox,
  StatusDot,
  type Metric,
  type Tone,
} from "@/components/admin/DataView";
import { Avatar } from "@/components/ui/Avatar";
import { Button, EmptyState, LoadingSkeleton, RoleBadge } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
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
  | { type: "bulk-deactivate"; users: AdminUserSummary[] }
  | { type: "bulk-delete"; users: AdminUserSummary[] }
  | null;

function userStatus(u: AdminUserSummary): { key: string; label: string; tone: Tone } {
  if (u.deleted_at) return { key: "deleted", label: "Deleted", tone: "neutral" };
  if (u.is_active) return { key: "active", label: "Active", tone: "success" };
  return { key: "inactive", label: "Inactive", tone: "warning" };
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const response = await listAdminUsers({ page: 1, page_size: 100 });
      setUsers(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const canManageUser = useCallback((u: AdminUserSummary) => {
    if (actor?.id === u.id) return false;
    return (isSuperAdmin || u.role === "user") && !u.deleted_at;
  }, [actor?.id, isSuperAdmin]);

  /* ── metrics ── */
  const metrics: Metric[] = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.is_active && !u.deleted_at).length;
    const admins = users.filter(u => (u.role === "admin" || u.role === "super_admin") && !u.deleted_at).length;
    const suspended = users.filter(u => u.deleted_at || !u.is_active).length;
    return [
      { label: "Total users", value: formatNumber(total), icon: "user", tone: "brand" },
      { label: "Active", value: formatNumber(active), icon: "checkCircle", tone: "success", hint: total ? `${Math.round((active / total) * 100)}%` : undefined },
      { label: "Admins", value: formatNumber(admins), icon: "shield", tone: "info" },
      { label: "Suspended", value: formatNumber(suspended), icon: "alertCircle", tone: suspended > 0 ? "warning" : "neutral" },
    ];
  }, [users]);

  /* ── filtering ── */
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch = !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
      return matchesSearch && (!role || u.role === role) && (!status || userStatus(u).key === status);
    });
  }, [role, search, status, users]);

  const visibleUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [role, search, status]);

  /* ── selection ── */
  const selectableVisible = visibleUsers.filter(canManageUser);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(u => selectedIds.has(u.id));
  const someVisibleSelected = selectableVisible.some(u => selectedIds.has(u.id));
  const selectedUsers = users.filter(u => selectedIds.has(u.id));
  const selectedActive = selectedUsers.filter(u => u.is_active && !u.deleted_at);

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((cur) => { const next = new Set(cur); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function toggleAllVisible(checked: boolean) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      selectableVisible.forEach(u => { if (checked) next.add(u.id); else next.delete(u.id); });
      return next;
    });
  }

  function applyUpdatedUser(u: AdminUserDetail) {
    setUsers((cur) => cur.map((x) => x.id === u.id ? {
      ...x, deleted_at: u.deleted_at, deactivated_at: u.deactivated_at, document_count: u.document_count,
      email: u.email, full_name: u.full_name, is_active: u.is_active, last_login_at: u.last_login_at,
      role: u.role, workspace_count: u.workspace_count,
    } : x));
  }

  async function submitAction(reason: string) {
    if (!pendingAction) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      if (pendingAction.type === "bulk-deactivate" || pendingAction.type === "bulk-delete") {
        const fn = pendingAction.type === "bulk-deactivate" ? deactivateAdminUser : deleteAdminUser;
        const results = await Promise.allSettled(pendingAction.users.map(u => fn(u.id, reason)));
        let failures = 0;
        results.forEach(r => { if (r.status === "fulfilled") applyUpdatedUser(r.value); else failures += 1; });
        if (failures > 0) { setModalError(`${failures} of ${results.length} action(s) failed.`); }
        else { setPendingAction(null); setSelectedIds(new Set()); }
      } else {
        const updated = pendingAction.type === "role"
          ? await updateAdminUserRole(pendingAction.user.id, pendingAction.nextRole, reason)
          : pendingAction.type === "deactivate"
            ? await deactivateAdminUser(pendingAction.user.id, reason)
            : pendingAction.type === "reactivate"
              ? await reactivateAdminUser(pendingAction.user.id, reason)
              : await deleteAdminUser(pendingAction.user.id, reason);
        applyUpdatedUser(updated);
        setPendingAction(null);
      }
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function exportSelected() {
    exportToCsv("users.csv", selectedUsers.map(u => ({
      name: u.full_name, email: u.email, role: u.role, status: userStatus(u).label,
      workspaces: u.workspace_count, documents: u.document_count, last_login: u.last_login_at ?? "",
    })));
  }

  if (isLoading) return <AdminAccessMessage title="Users" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="Users" label="Admin access required." />;

  const actionLabel =
    pendingAction?.type === "role" ? `Change role for ${pendingAction.user.email}`
    : pendingAction?.type === "deactivate" ? `Deactivate ${pendingAction.user.email}`
    : pendingAction?.type === "reactivate" ? `Reactivate ${pendingAction.user.email}`
    : pendingAction?.type === "delete" ? `Delete ${pendingAction.user.email}`
    : pendingAction?.type === "bulk-deactivate" ? `Deactivate ${pendingAction.users.length} users`
    : pendingAction?.type === "bulk-delete" ? `Delete ${pendingAction.users.length} users`
    : "Confirm user action";
  const isDestructive = pendingAction?.type === "delete" || pendingAction?.type === "bulk-delete";

  return (
    <AdminShell title="Users" description="Manage global user access, roles, and lifecycle.">
      <div className="grid gap-5">
        <ErrorBanner message={error} onRetry={() => void load()} />

        <MetricStrip metrics={metrics} />

        {/* toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox value={search} onChange={setSearch} placeholder="Search name or email…" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills ariaLabel="Filter by role" value={role} onChange={setRole}
              options={[
                { value: "", label: "All roles" },
                { value: "user", label: "User" },
                { value: "admin", label: "Admin" },
                { value: "super_admin", label: "Super" },
              ]} />
            <FilterPills ariaLabel="Filter by status" value={status} onChange={setStatus}
              options={[
                { value: "", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "deleted", label: "Deleted" },
              ]} />
          </div>
        </div>

        {/* bulk bar */}
        <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
          <BulkButton icon="fileText" onClick={exportSelected}>Export CSV</BulkButton>
          {selectedActive.length > 0 ? (
            <BulkButton icon="alertCircle" onClick={() => setPendingAction({ type: "bulk-deactivate", users: selectedActive })}>
              Deactivate ({selectedActive.length})
            </BulkButton>
          ) : null}
          <BulkButton icon="trash" tone="danger" onClick={() => setPendingAction({ type: "bulk-delete", users: selectedUsers.filter(u => !u.deleted_at) })}>
            Delete
          </BulkButton>
        </BulkBar>

        <DataSection title="User directory" count={filteredUsers.length} countLabel="users">
          {isFetching ? (
            <div className="p-4"><LoadingSkeleton label="Loading users" rows={4} /></div>
          ) : visibleUsers.length === 0 ? (
            <div className="p-4"><EmptyState title="No users found" description="Try changing the search or filters." /></div>
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col" className="w-10 px-3 py-2.5">
                        <Check ariaLabel="Select all visible users" checked={allVisibleSelected} indeterminate={someVisibleSelected}
                          disabled={selectableVisible.length === 0} onChange={toggleAllVisible} />
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">User</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Workspaces</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Last login</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((u) => {
                      const st = userStatus(u);
                      const manageable = canManageUser(u);
                      const selected = selectedIds.has(u.id);
                      return (
                        <tr key={u.id} className={`group transition hover:bg-hover ${selected ? "bg-brand-subtle/40" : ""}`}>
                          <td className="px-3 py-3">
                            <Check ariaLabel={`Select ${u.email}`} checked={selected} disabled={!manageable} onChange={(c) => toggleOne(u.id, c)} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={u.full_name} email={u.email} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-fg">{u.full_name || "—"}</p>
                                <p className="truncate text-xs text-fg-subtle">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3"><RoleBadge role={u.role} /></td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
                              <StatusDot tone={st.tone} /> {st.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-fg-muted">{formatNumber(u.workspace_count)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-fg-subtle">{formatDate(u.last_login_at)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                              <Link href={`/admin/users/${u.id}`}
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg">
                                <Icon name="eye" size={13} /> View
                              </Link>
                              {manageable ? (
                                <>
                                  <Button type="button" size="sm" variant="secondary"
                                    onClick={() => setPendingAction({ nextRole: u.role === "user" ? "admin" : "user", type: "role", user: u })}>
                                    {u.role === "user" ? "Make admin" : "Make user"}
                                  </Button>
                                  {u.is_active ? (
                                    <Button type="button" size="sm" variant="secondary" onClick={() => setPendingAction({ type: "deactivate", user: u })}>Deactivate</Button>
                                  ) : (
                                    <Button type="button" size="sm" variant="secondary" onClick={() => setPendingAction({ type: "reactivate", user: u })}>Reactivate</Button>
                                  )}
                                  <Button type="button" size="sm" variant="danger" onClick={() => setPendingAction({ type: "delete", user: u })}>Delete</Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pageSize={PAGE_SIZE} total={filteredUsers.length} onPage={setPage} />
            </>
          )}
        </DataSection>
      </div>

      <ConfirmReasonModal
        isOpen={pendingAction !== null}
        actionLabel={actionLabel}
        confirmLabel={isDestructive ? "Delete" : "Confirm"}
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText={isDestructive}
        onClose={() => { setPendingAction(null); setModalError(null); }}
        onConfirm={submitAction}
      />
    </AdminShell>
  );
}
