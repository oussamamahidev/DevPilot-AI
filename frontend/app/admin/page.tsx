"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { LoadingState } from "@/components/LoadingState";
import {
  getAdminDocumentsStats,
  getAdminRagStats,
  getAdminUsageStats,
  listAdminErrors,
  listAdminUsers,
  listAdminWorkspaces,
} from "@/lib/admin";
import { ApiRequestError } from "@/lib/api";
import { removeToken } from "@/lib/auth";
import { useAuthUser } from "@/hooks/useAuthUser";
import type {
  AdminDocumentsStats,
  AdminErrorsResponse,
  AdminRagStats,
  AdminUsageStats,
  AdminUserSummary,
  AdminWorkspaceSummary,
} from "@/types";

type AdminDashboardData = {
  documents: AdminDocumentsStats;
  errors: AdminErrorsResponse;
  rag: AdminRagStats;
  usage: AdminUsageStats;
  users: AdminUserSummary[];
  workspaces: AdminWorkspaceSummary[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function metric(label: string, value: string, detail: string) {
  return { detail, label, value };
}

function MetricCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </section>
  );
}

function StatusBars({ documents }: { documents: AdminDocumentsStats }) {
  const statuses = Object.entries(documents.documents_by_status);
  const total = Math.max(documents.total_documents, 1);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Document Status</h2>
      <div className="mt-5 grid gap-4">
        {statuses.length === 0 ? (
          <p className="text-sm text-slate-600">No documents indexed yet.</p>
        ) : (
          statuses.map(([status, count]) => {
            const width = Math.max(4, Math.round((count / total) * 100));
            return (
              <div key={status}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium capitalize text-slate-700">
                    {status}
                  </span>
                  <span className="text-slate-500">{formatNumber(count)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-md bg-slate-100">
                  <div
                    className="h-full rounded-md bg-slate-950"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function QualityBars({ rag }: { rag: AdminRagStats }) {
  const rows = [
    { label: "Faithfulness", value: rag.average_faithfulness },
    { label: "Relevance", value: rag.average_relevance },
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Answer Quality</h2>
      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{row.label}</span>
              <span className="text-slate-500">{formatDecimal(row.value, 3)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-md bg-slate-100">
              <div
                className="h-full rounded-md bg-emerald-600"
                style={{ width: `${Math.round(Math.min(row.value, 1) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAdminData = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const [users, workspaces, documents, rag, usage, errors] =
        await Promise.all([
          listAdminUsers(),
          listAdminWorkspaces(),
          getAdminDocumentsStats(),
          getAdminRagStats(),
          getAdminUsageStats(),
          listAdminErrors(),
        ]);

      setData({ documents, errors, rag, usage, users, workspaces });
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(requestError.message);
      } else {
        setError("Unable to load admin dashboard data.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return;
    }

    void loadAdminData();
  }, [loadAdminData, user]);

  const metrics = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      metric("Users", formatNumber(data.users.length), "Registered accounts"),
      metric(
        "Workspaces",
        formatNumber(data.workspaces.length),
        "Workspaces across the platform",
      ),
      metric(
        "Documents",
        formatNumber(data.documents.total_documents),
        `${formatNumber(data.documents.total_chunks)} chunks indexed`,
      ),
      metric(
        "RAG queries",
        formatNumber(data.rag.total_rag_queries),
        `${formatDecimal(data.rag.average_latency_ms, 1)} ms average latency`,
      ),
      metric(
        "Tokens",
        formatNumber(data.usage.total_tokens),
        `${formatNumber(data.usage.prompt_tokens)} prompt, ${formatNumber(
          data.usage.completion_tokens,
        )} completion`,
      ),
      metric(
        "Estimated cost",
        formatCurrency(data.usage.estimated_cost_usd),
        "From recorded LLM usage rows",
      ),
    ];
  }, [data]);

  const recentUsers = data?.users.slice(0, 10) ?? [];
  const recentDocuments = data?.documents.recent_documents.slice(0, 10) ?? [];

  if (isAuthLoading) {
    return (
      <DashboardShell
        activeItem="admin"
        title="Admin"
        description="Platform operations and RAG usage."
      >
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Checking admin access" />
        </section>
      </DashboardShell>
    );
  }

  if (user && user.role !== "admin") {
    return (
      <DashboardShell
        activeItem="admin"
        title="Admin"
        description="Platform operations and RAG usage."
      >
        <section className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Admin access required.
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="admin"
      title="Admin"
      description="Platform operations, document health, RAG quality, usage, and recent errors."
    >
      {authError ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {authError}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={loadAdminData}
          disabled={isLoading}
          className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {isLoading && !data ? (
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Loading admin dashboard" />
        </section>
      ) : null}

      {data ? (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map((item) => (
              <MetricCard
                key={item.label}
                detail={item.detail}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <StatusBars documents={data.documents} />
            <QualityBars rag={data.rag} />
          </div>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Recent Users</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">User</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Role</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Workspaces</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Documents</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentUsers.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-950">{item.full_name}</div>
                        <div className="text-xs text-slate-500">{item.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 capitalize text-slate-700">
                        {item.role}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(item.workspace_count)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatNumber(item.document_count)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Recent Documents</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">File</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Uploader</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentDocuments.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-950">{item.filename}</div>
                        <div className="text-xs uppercase text-slate-500">{item.file_type}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {item.workspace_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 capitalize text-slate-700">
                        {item.status}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {item.uploader_email ?? "Unknown"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Recent Errors</h2>
            <div className="mt-5 grid gap-3">
              {data.errors.errors.length === 0 ? (
                <p className="text-sm text-slate-600">No recent errors.</p>
              ) : (
                data.errors.errors.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{item.message}</p>
                        <p className="mt-1 text-xs uppercase text-slate-500">
                          {item.source} / {item.status}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </DashboardShell>
  );
}
