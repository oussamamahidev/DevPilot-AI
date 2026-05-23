"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { LoadingState } from "@/components/LoadingState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { deleteDocument, listDocuments } from "@/lib/documents";
import type { Document } from "@/types";

type WorkspaceDocumentsPanelProps = {
  showUpload?: boolean;
  workspaceId: string;
};

type RequestErrorMessages = {
  network: string;
  unexpected: string;
};

type RefreshFailureMode = "error" | "uploadStatusWarning";

type RefreshDocumentsOptions = {
  failureMode?: RefreshFailureMode;
  showSpinner?: boolean;
};

const UPLOAD_STATUS_REFRESH_WARNING =
  "Upload succeeded, but status refresh failed.";

function hasActiveDocument(documents: Document[]) {
  return documents.some((document) =>
    ["queued", "processing", "uploaded"].includes(document.status),
  );
}

export function WorkspaceDocumentsPanel({
  showUpload = false,
  workspaceId,
}: WorkspaceDocumentsPanelProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shouldWarnStatusRefreshFailure, setShouldWarnStatusRefreshFailure] =
    useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleRequestError = useCallback(
    (requestError: unknown, messages: RequestErrorMessages) => {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(requestError.message);
        return;
      }

      if (requestError instanceof ApiConnectionError) {
        setError(messages.network);
        return;
      }

      setError(messages.unexpected);
    },
    [router],
  );

  const handleStatusRefreshError = useCallback(
    (requestError: unknown) => {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        removeToken();
        router.replace("/login");
        return;
      }

      setWarning(UPLOAD_STATUS_REFRESH_WARNING);
    },
    [router],
  );

  const refreshDocuments = useCallback(
    async ({
      failureMode = "error",
      showSpinner = false,
    }: RefreshDocumentsOptions = {}) => {
      if (showSpinner) {
        setIsRefreshing(true);
      }

      try {
        const response = await listDocuments(workspaceId);
        setDocuments(response);
        setError(null);
        setWarning(null);

        if (!hasActiveDocument(response)) {
          setShouldWarnStatusRefreshFailure(false);
        }

        return true;
      } catch (requestError) {
        if (failureMode === "uploadStatusWarning") {
          handleStatusRefreshError(requestError);
        } else {
          handleRequestError(requestError, {
            network: "Unable to load documents. Check that the API is running.",
            unexpected: "Unable to load documents.",
          });
        }

        return false;
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [handleRequestError, handleStatusRefreshError, workspaceId],
  );

  useEffect(() => {
    setIsLoading(true);
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    if (!hasActiveDocument(documents)) {
      return;
    }

    const failureMode: RefreshFailureMode = shouldWarnStatusRefreshFailure
      ? "uploadStatusWarning"
      : "error";

    const intervalId = window.setInterval(() => {
      void refreshDocuments({ failureMode });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [documents, refreshDocuments, shouldWarnStatusRefreshFailure]);

  async function handleDeleteConfirmed() {
    if (!pendingDeleteId) {
      return;
    }

    setError(null);
    setWarning(null);
    setIsDeleting(true);

    try {
      await deleteDocument(pendingDeleteId);
      setDocuments((current) =>
        current.filter((document) => document.id !== pendingDeleteId),
      );
      setPendingDeleteId(null);
    } catch (requestError) {
      handleRequestError(requestError, {
        network: "Unable to remove the document. Check that the API is running.",
        unexpected: "Unable to remove the document.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid gap-6">
      {showUpload ? (
        <DocumentUploadForm
          workspaceId={workspaceId}
          onUploadStarted={() => {
            setError(null);
            setWarning(null);
          }}
          onUploaded={async (document) => {
            setError(null);
            setWarning(null);
            setShouldWarnStatusRefreshFailure(true);
            setDocuments((current) => [
              document,
              ...current.filter((item) => item.id !== document.id),
            ]);
            await refreshDocuments({ failureMode: "uploadStatusWarning" });
          }}
        />
      ) : null}

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Documents
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Uploaded files and indexing status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshDocuments({ showSpinner: true })}
            disabled={isRefreshing}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {hasActiveDocument(documents) ? (
          <p className="mt-3 text-xs text-amber-700">
            Processing documents refresh every 3 seconds.
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {warning ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {warning}
          </div>
        ) : null}

        <div className="mt-5">
          {isLoading ? (
            <LoadingState label="Loading documents" />
          ) : (
            <DocumentList
              documents={documents}
              onDelete={(documentId) => setPendingDeleteId(documentId)}
            />
          )}
        </div>
      </section>

      <ConfirmDialog
        confirmLabel="Remove document"
        description="This removes the document from the workspace. Continue only if you no longer need this file indexed for chat."
        isOpen={Boolean(pendingDeleteId)}
        isSubmitting={isDeleting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void handleDeleteConfirmed()}
        title="Remove document?"
      />
    </div>
  );
}
