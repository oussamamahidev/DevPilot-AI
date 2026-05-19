"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ErrorBanner,
  formatDate,
  formatNumber,
  PaginationControls,
  RoleBadge,
  StatusBadge,
  Toolbar,
} from "@/components/admin/AdminUI";
import { LoadingState } from "@/components/LoadingState";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { listAdminUsers } from "@/lib/admin";
import type { AdminUserSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

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

  if (isLoading) {
    return <AdminAccessMessage title="Users" label="Checking admin access." />;
  }

  if (!isAdmin) {
    return <AdminAccessMessage title="Users" label="Admin access required." />;
  }

  return (
    <AdminShell title="Users" description="Manage global user access and roles.">
      <ErrorBanner message={error} />
      <Toolbar search={search} setSearch={setSearch}>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
        </select>
      </Toolbar>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">User Directory</h2>
          <span className="text-sm text-slate-500">
            {formatNumber(filteredUsers.length)} users
          </span>
        </div>

        {isFetching ? <LoadingState label="Loading users" /> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">User</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Role</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspaces</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Last Login</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-950">{user.full_name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge isActive={user.is_active} deletedAt={user.deleted_at} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {formatNumber(user.workspace_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          setPage={setPage}
          canPrevious={page > 0}
          canNext={(page + 1) * PAGE_SIZE < filteredUsers.length}
        />
      </section>
    </AdminShell>
  );
}
