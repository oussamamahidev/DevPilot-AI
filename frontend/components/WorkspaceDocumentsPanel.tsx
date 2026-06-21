"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { deleteDocument, listDocuments } from "@/lib/documents";
import type { Document } from "@/types";

type WorkspaceDocumentsPanelProps = {
  showUpload?: boolean;
  workspaceId: string;
};

type RefreshMode = "error" | "uploadStatusWarning";

function hasInFlight(docs: Document[]) {
  return docs.some((d) => ["queued", "processing", "uploaded"].includes(d.status));
}

export function WorkspaceDocumentsPanel({ showUpload = false, workspaceId }: WorkspaceDocumentsPanelProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [warnOnStatusRefresh, setWarnOnStatusRefresh] = useState(false);

  const handleErr = useCallback((e: unknown, fallback: string) => {
    if (e instanceof ApiRequestError) {
      if (e.status === 401) { removeToken(); router.replace("/login"); return; }
      setError(e.message);
    } else if (e instanceof ApiConnectionError) {
      setError(fallback);
    } else {
      setError(fallback);
    }
  }, [router]);

  const refresh = useCallback(async ({ mode = "error", spinner = false }: { mode?: RefreshMode; spinner?: boolean } = {}) => {
    if (spinner) setIsRefreshing(true);
    try {
      const res = await listDocuments(workspaceId);
      setDocuments(res);
      setError(null);
      setWarning(null);
      if (!hasInFlight(res)) setWarnOnStatusRefresh(false);
      return true;
    } catch (e) {
      if (mode === "uploadStatusWarning") {
        if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return false; }
        setWarning("Upload succeeded but status refresh failed.");
      } else {
        handleErr(e, "Unable to load documents.");
      }
      return false;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, handleErr, router]);

  useEffect(() => { setIsLoading(true); void refresh(); }, [refresh]);

  useEffect(() => {
    if (!hasInFlight(documents)) return;
    const mode: RefreshMode = warnOnStatusRefresh ? "uploadStatusWarning" : "error";
    const id = window.setInterval(() => void refresh({ mode }), 3000);
    return () => window.clearInterval(id);
  }, [documents, refresh, warnOnStatusRefresh]);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setError(null);
    setWarning(null);
    setIsDeleting(true);
    try {
      await deleteDocument(pendingDeleteId);
      setDocuments((c) => c.filter((d) => d.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch (e) {
      handleErr(e, "Unable to remove the document.");
    } finally { setIsDeleting(false); }
  }

  return (
    <div className="grid gap-4">
      {showUpload ? (
        <DocumentUploadForm
          workspaceId={workspaceId}
          onUploadStarted={() => { setError(null); setWarning(null); }}
          onUploaded={async (doc) => {
            setError(null);
            setWarning(null);
            setWarnOnStatusRefresh(true);
            setDocuments((c) => [doc, ...c.filter((d) => d.id !== doc.id)]);
            await refresh({ mode: "uploadStatusWarning" });
          }}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-fg">Documents</p>
            {hasInFlight(documents) ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-warning-surface-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-warning motion-safe:animate-pulse" />
                Processing — auto-refreshes every 3 s
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-fg-muted">Uploaded files and ingestion status</p>
            )}
          </div>
          <Button variant="ghost" size="sm" isLoading={isRefreshing} onClick={() => void refresh({ spinner: true })}>
            <Icon name="refreshCw" size={14} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>

        {error ? (
          <div className="border-b border-line bg-danger-subtle px-4 py-2.5 text-xs text-danger-surface-fg">{error}</div>
        ) : null}
        {warning ? (
          <div className="border-b border-line bg-warning-subtle px-4 py-2.5 text-xs text-warning-surface-fg">{warning}</div>
        ) : null}

        <div className="p-4">
          <DocumentList
            documents={documents.filter((d) => d.status !== "deleted")}
            isLoading={isLoading}
            onDelete={(id) => setPendingDeleteId(id)}
          />
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Remove document"
        description="This removes the document from the workspace and it will no longer be used for retrieval."
        isOpen={Boolean(pendingDeleteId)}
        isSubmitting={isDeleting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void handleDelete()}
        title="Remove document?"
      />
    </div>
  );
}
