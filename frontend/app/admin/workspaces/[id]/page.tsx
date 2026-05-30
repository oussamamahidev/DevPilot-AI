"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { EmptyState, LoadingSkeleton } from "@/components/ui";
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
      <ErrorBanner message={error} onRetry={() => void load()} />
      {isFetching && !workspace ? (
        <LoadingSkeleton label="Loading workspace" rows={3} />
      ) : null}

      {workspace ? (
        <div className="grid gap-6">
          <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-fg">{workspace.name}</h2>
                <p className="mt-1 text-sm text-fg-muted">{workspace.description ?? "No description"}</p>
                <p className="mt-2 text-sm text-fg-subtle">Owner: {workspace.owner_email}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="h-10 rounded-md bg-danger px-4 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
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

          <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-fg">Document Status</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(workspace.documents_by_status).map(([status, count]) => (
                <div key={status} className="rounded-md border border-line bg-sunken p-3">
                  <StatusBadge status={status} />
                  <p className="mt-2 text-lg font-semibold text-fg">{formatNumber(count)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-fg">Members</h2>
              <span className="text-sm text-fg-subtle">
                {formatNumber(workspace.members.length)} members
              </span>
            </div>
            {workspace.members.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-line-strong bg-sunken p-4 text-sm text-fg-muted">
                No members found.
              </p>
            ) : (
              <div className="admin-table-scroll mt-5">
                <table className="admin-table">
                  <thead className="bg-sunken text-xs uppercase text-fg-subtle">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Member</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Role</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {workspace.members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-3 py-3">
                          <p className="font-medium text-fg">{member.full_name}</p>
                          <p className="text-xs text-fg-subtle">{member.email}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                          {member.role}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-fg-subtle">
                          {formatDate(member.joined_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-fg">Documents</h2>
              <span className="text-sm text-fg-subtle">
                {formatNumber(workspace.documents.length)} documents
              </span>
            </div>
            {workspace.documents.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-line-strong bg-sunken p-4 text-sm text-fg-muted">
                No documents found.
              </p>
            ) : (
              <div className="admin-table-scroll mt-5">
                <table className="admin-table">
                  <thead className="bg-sunken text-xs uppercase text-fg-subtle">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Filename</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Chunks</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {workspace.documents.map((document) => (
                      <tr key={document.id}>
                        <td className="px-3 py-3 font-medium text-fg">
                          {document.filename}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <StatusBadge status={document.status} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                          {formatNumber(document.chunks_count)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-fg-subtle">
                          {formatDate(document.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <Link
                            href={`/admin/documents/${document.id}`}
                            className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-fg">Lifecycle</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info label="Created" value={formatDate(workspace.created_at)} />
              <Info label="Updated" value={formatDate(workspace.updated_at)} />
            </div>
          </section>
        </div>
      ) : !isFetching && !error ? (
        <EmptyState
          title="Workspace not found"
          description="This workspace may have been deleted or the identifier is invalid."
        />
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
    <div className="rounded-md border border-line bg-sunken p-4">
      <p className="text-xs uppercase text-fg-subtle">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-fg">{value}</p>
    </div>
  );
}
