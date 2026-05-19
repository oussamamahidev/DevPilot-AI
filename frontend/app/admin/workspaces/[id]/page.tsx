"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AdminAccessMessage,
  AdminShell,
  ConfirmReasonModal,
  ErrorBanner,
  formatDate,
  formatNumber,
  StatusBadge,
} from "@/components/admin/AdminUI";
import { LoadingState } from "@/components/LoadingState";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { deleteAdminWorkspace, getAdminWorkspace } from "@/lib/admin";
import type { AdminWorkspaceDetail } from "@/types";

export default function AdminWorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin, isLoading } = useAdminAccess();
  const [workspace, setWorkspace] = useState<AdminWorkspaceDetail | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workspaceId = params.id;

  const load = useCallback(async () => {
    if (!isAdmin || !workspaceId) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      setWorkspace(await getAdminWorkspace(workspaceId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load workspace.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteWorkspace(reason: string) {
    if (!workspace || reason.trim().length < 3) {
      setModalError("Enter a reason with at least 3 characters.");
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      await deleteAdminWorkspace(workspace.id, reason);
      router.replace("/admin/workspaces");
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : "Delete failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <AdminAccessMessage title="Workspace Detail" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Workspace Detail" label="Admin access required." />;
  }

  return (
    <AdminShell title="Workspace Detail" description="Review workspace ownership and RAG data.">
      <ErrorBanner message={error} />
      {isFetching && !workspace ? (
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Loading workspace" />
        </section>
      ) : null}

      {workspace ? (
        <div className="grid gap-6">
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{workspace.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{workspace.description ?? "No description"}</p>
                <p className="mt-2 text-sm text-slate-500">Owner: {workspace.owner_email}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="h-10 rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-800"
              >
                Delete Workspace
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <Info label="Members" value={formatNumber(workspace.member_count)} />
              <Info label="Documents" value={formatNumber(workspace.document_count)} />
              <Info label="Chunks" value={formatNumber(workspace.total_chunks)} />
              <Info label="Conversations" value={formatNumber(workspace.conversations_count)} />
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Document Status</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(workspace.documents_by_status).map(([status, count]) => (
                <div key={status} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <StatusBadge status={status} />
                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatNumber(count)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Lifecycle</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info label="Created" value={formatDate(workspace.created_at)} />
              <Info label="Updated" value={formatDate(workspace.updated_at)} />
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmReasonModal
        isOpen={isConfirmingDelete}
        actionLabel="Delete workspace"
        confirmLabel="Delete"
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText
        onClose={() => {
          setIsConfirmingDelete(false);
          setModalError(null);
        }}
        onConfirm={deleteWorkspace}
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
