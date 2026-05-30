"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Select,
  StatusBadge,
} from "@/components/ui";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { retryRagOpsDocument } from "@/lib/admin";
import { removeToken } from "@/lib/auth";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import {
  deleteDocument,
  getDocumentStatus,
  listDocuments,
  uploadDocument,
} from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { listWorkspaces } from "@/lib/workspaces";
import type { Document, DocumentStatus, Workspace } from "@/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"];

const statusDetails: Record<
  DocumentStatus,
  { description: string; label: string }
> = {
  deleted: {
    description: "Removed from the active workspace document set.",
    label: "Deleted",
  },
  failed: {
    description: "Needs retry or log inspection before it can be used.",
    label: "Failed",
  },
  indexed: {
    description: "Ready for RAG chat and retrieval.",
    label: "Indexed",
  },
  processing: {
    description: "Extraction, chunking, embedding, and indexing are running.",
    label: "Processing",
  },
  queued: {
    description: "Waiting for Celery to pick up ingestion.",
    label: "Queued",
  },
  uploaded: {
    description: "Uploaded and waiting to enter the ingestion queue.",
    label: "Uploaded",
  },
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(amount >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not processed";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getExtension(filename: string) {
  const normalized = filename.toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

function validateFile(file: File | null) {
  if (!file) {
    return "Choose a supported document before uploading.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large. Max size is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }

  const extension = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return "Unsupported format. Upload PDF, TXT, Markdown, or MD files.";
  }

  return null;
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function hasProcessingDocuments(documents: Document[]) {
  return documents.some((document) =>
    ["queued", "processing", "uploaded"].includes(document.status),
  );
}

function isAdminRole(role: string | undefined) {
  return role === "admin" || role === "super_admin";
}

export default function DocumentsPage() {
  const router = useRouter();
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [statusCheckingId, setStatusCheckingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const selectedWorkspace = workspaces.find(
    (workspace) => workspace.id === selectedWorkspaceId,
  );
  const canUseAdminActions = isAdminRole(user?.role);

  const documentStats = useMemo(() => {
    const activeDocuments = documents.filter(
      (document) => document.status !== "deleted",
    );
    const count = (statuses: DocumentStatus[]) =>
      activeDocuments.filter((document) => statuses.includes(document.status)).length;

    return {
      activeDocuments,
      failed: count(["failed"]),
      indexed: count(["indexed"]),
      processing: count(["processing"]),
      queued: count(["queued", "uploaded"]),
      total: activeDocuments.length,
    };
  }, [documents]);

  const loadDocuments = useCallback(
    async ({ showSpinner = false }: { showSpinner?: boolean } = {}) => {
      if (!selectedWorkspaceId) {
        setDocuments([]);
        return;
      }

      if (showSpinner) {
        setIsRefreshing(true);
      } else {
        setIsLoadingDocuments(true);
      }

      try {
        const response = await listDocuments(selectedWorkspaceId);
        setDocuments(response);
        setError(null);
      } catch (requestError) {
        if (requestError instanceof ApiRequestError) {
          if (requestError.status === 401) {
            removeToken();
            router.replace("/login");
            return;
          }

          if (requestError.status === 403) {
            setError(COMMON_ERROR_MESSAGES.forbidden);
            return;
          }
        }

        setError(
          requestErrorMessage(
            requestError,
            "Unable to load documents for this workspace.",
          ),
        );
      } finally {
        setIsLoadingDocuments(false);
        setIsRefreshing(false);
      }
    },
    [router, selectedWorkspaceId],
  );

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    async function loadWorkspaces() {
      setIsLoadingWorkspaces(true);
      setError(null);

      try {
        const response = await listWorkspaces();
        if (!isMounted) {
          return;
        }

        setWorkspaces(response);
        setSelectedWorkspaceId((current) => current || response[0]?.id || "");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        if (requestError instanceof ApiRequestError && requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(
          requestErrorMessage(requestError, "Unable to load your workspaces."),
        );
      } finally {
        if (isMounted) {
          setIsLoadingWorkspaces(false);
        }
      }
    }

    void loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [router, user]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!hasProcessingDocuments(documents)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDocuments({ showSpinner: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [documents, loadDocuments]);

  useEffect(() => {
    if (!isUploading) {
      return;
    }

    setUploadProgress((current) => (current < 15 ? 15 : current));
    const intervalId = window.setInterval(() => {
      setUploadProgress((current) => Math.min(current + 8, 90));
    }, 350);

    return () => window.clearInterval(intervalId);
  }, [isUploading]);

  function handleSelectedFile(file: File | null) {
    setSuccess(null);
    setSelectedFile(file);
    setFileError(validateFile(file));
    setUploadProgress(0);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelectedFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleSelectedFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWorkspaceId) {
      setError("Create or select a workspace before uploading.");
      return;
    }

    const validationError = validateFile(selectedFile);
    setFileError(validationError);
    if (validationError || !selectedFile) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const document = await uploadDocument(selectedWorkspaceId, selectedFile);
      setUploadProgress(100);
      setSuccess(`${document.filename} uploaded and queued for ingestion.`);
      setSelectedFile(null);
      setDocuments((current) => [
        document,
        ...current.filter((item) => item.id !== document.id),
      ]);
      await loadDocuments({ showSpinner: true });
    } catch (requestError) {
      setUploadProgress(0);

      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        if (requestError.status === 403) {
          setError(COMMON_ERROR_MESSAGES.forbidden);
          return;
        }
      }

      setError(
        requestErrorMessage(
          requestError,
          "Upload failed. Check the file and try again.",
        ),
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleViewStatus(document: Document) {
    setStatusCheckingId(document.id);
    setError(null);

    try {
      const response = await getDocumentStatus(document.id);
      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id ? { ...item, status: response.status } : item,
        ),
      );
    } catch (requestError) {
      setError(requestErrorMessage(requestError, "Unable to fetch document status."));
    } finally {
      setStatusCheckingId(null);
    }
  }

  async function handleRetry(document: Document) {
    setRetryingId(document.id);
    setError(null);

    try {
      await retryRagOpsDocument(document.id, "Retry requested from documents page");
      await loadDocuments({ showSpinner: true });
      setSuccess(`${document.filename} retry requested.`);
    } catch (requestError) {
      setError(
        requestErrorMessage(
          requestError,
          "Retry is not available for this document.",
        ),
      );
    } finally {
      setRetryingId(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDeleteId) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteDocument(pendingDeleteId);
      setDocuments((current) =>
        current.filter((document) => document.id !== pendingDeleteId),
      );
      setPendingDeleteId(null);
    } catch (requestError) {
      setError(requestErrorMessage(requestError, "Unable to delete document."));
    } finally {
      setIsDeleting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <DashboardShell
        activeItem="documents"
        title="Documents"
        description="Loading document access."
      >
        <LoadingSkeleton label="Checking authentication" rows={4} />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell
        activeItem="documents"
        title="Documents"
        description="Upload documents, track ingestion, and confirm when files are ready for RAG."
      >
        <ErrorState
          action={
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
          message={authError ?? "Your session expired. Please login again."}
          title="Unable to load documents"
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="documents"
      title="Documents"
      description="Upload documents, track ingestion, and confirm when files are ready for RAG."
    >
      <div className="grid gap-6">
        <ErrorState message={authError} title="Authentication warning" />
        <ErrorState
          action={
            error ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadDocuments({ showSpinner: true })}
              >
                Retry
              </Button>
            ) : undefined
          }
          message={error}
        />

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-end">
              <div>
                <Badge tone="ai">Document Ingestion</Badge>
                <h1 className="mt-4 text-2xl font-semibold text-fg">
                  Upload and monitor knowledge documents
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">
                  Choose a workspace, upload supported files, and watch Celery
                  ingestion progress until documents are indexed and ready for
                  chat retrieval.
                </p>
              </div>
              <Select
                label="Workspace"
                value={selectedWorkspaceId}
                onChange={(event) => {
                  setSelectedWorkspaceId(event.target.value);
                  setSuccess(null);
                  setError(null);
                }}
                disabled={isLoadingWorkspaces || workspaces.length === 0}
              >
                {workspaces.length === 0 ? (
                  <option value="">No workspaces</option>
                ) : null}
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-medium text-fg-subtle">Selected workspace</p>
            <p className="mt-2 truncate text-xl font-semibold text-fg">
              {selectedWorkspace?.name ?? "No workspace selected"}
            </p>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              {selectedWorkspace
                ? selectedWorkspace.description ?? "No description"
                : "Create a workspace first to upload documents."}
            </p>
            {selectedWorkspace ? (
              <Link
                href={`/workspaces/${selectedWorkspace.id}/chat`}
                className="mt-4 inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                Ask a question
              </Link>
            ) : (
              <Link
                href="/dashboard#create-workspace"
                className="mt-4 inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                Create workspace
              </Link>
            )}
          </Card>
        </section>

        {workspaces.length === 0 && !isLoadingWorkspaces ? (
          <EmptyState
            title="Create a workspace before uploading"
            description="Documents are scoped to workspaces so retrieval and chat history stay isolated."
            action={
              <Link
                href="/dashboard#create-workspace"
                className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                Create workspace
              </Link>
            }
          />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader
              title="Upload Document"
              description="Drag a file here or browse from your computer."
            />
            <form onSubmit={handleUpload} className="grid gap-4">
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={[
                  "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 text-center transition",
                  isDragging
                    ? "border-brand bg-sunken"
                    : "border-line-strong bg-sunken hover:border-line-strong",
                  !selectedWorkspaceId ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
              >
                <input
                  type="file"
                  accept={SUPPORTED_EXTENSIONS.join(",")}
                  className="sr-only"
                  disabled={!selectedWorkspaceId || isUploading}
                  onChange={handleInputChange}
                />
                <span className="rounded-md bg-surface px-3 py-2 text-sm font-semibold text-fg shadow-sm">
                  {selectedFile ? selectedFile.name : "Choose or drop a file"}
                </span>
                <p className="mt-3 text-sm leading-6 text-fg-muted">
                  Supports PDF, TXT, Markdown, and MD files up to{" "}
                  {formatBytes(MAX_UPLOAD_BYTES)}.
                </p>
                {selectedFile ? (
                  <p className="mt-2 text-xs text-fg-subtle">
                    {formatBytes(selectedFile.size)}
                  </p>
                ) : null}
              </label>

              <div className="grid gap-2 rounded-md bg-sunken p-3 text-sm text-fg-muted">
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_EXTENSIONS.map((extension) => (
                    <Badge key={extension}>{extension}</Badge>
                  ))}
                </div>
                <p>Unsupported formats and files larger than the limit are blocked before upload.</p>
              </div>

              <ErrorState message={fileError} title="File validation failed" />
              {success ? (
                <section className="rounded-md border border-success-line bg-success-subtle px-4 py-3 text-sm text-success-surface-fg">
                  {success}
                </section>
              ) : null}

              {(isUploading || uploadProgress > 0) && selectedFile ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">
                    <span>{isUploading ? "Uploading..." : "Upload complete"}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-sunken">
                    <div
                      className="h-2 rounded-full bg-brand transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={!selectedWorkspaceId || Boolean(fileError) || !selectedFile}
                isLoading={isUploading}
              >
                {isUploading ? "Uploading..." : "Upload document"}
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Ingestion Status"
              description="What each document state means in the RAG pipeline."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {(["queued", "processing", "indexed", "failed"] as DocumentStatus[]).map(
                (status) => (
                  <div key={status} className="rounded-md border border-line bg-sunken p-4">
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge status={status} />
                      <span className="text-sm font-semibold text-fg">
                        {status === "indexed"
                          ? documentStats.indexed
                          : status === "processing"
                            ? documentStats.processing
                            : status === "queued"
                              ? documentStats.queued
                              : documentStats.failed}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-fg-muted">
                      {statusDetails[status].description}
                    </p>
                  </div>
                ),
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <p className="text-sm font-medium text-fg-subtle">Total</p>
            <p className="mt-2 text-2xl font-semibold text-fg">
              {documentStats.total}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-fg-subtle">Ready for RAG</p>
            <p className="mt-2 text-2xl font-semibold text-success-surface-fg">
              {documentStats.indexed}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-fg-subtle">In Progress</p>
            <p className="mt-2 text-2xl font-semibold text-info-surface-fg">
              {documentStats.processing + documentStats.queued}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-fg-subtle">Failed</p>
            <p className="mt-2 text-2xl font-semibold text-danger-surface-fg">
              {documentStats.failed}
            </p>
          </Card>
        </section>

        <Card>
          <CardHeader
            title="Documents"
            description={
              hasProcessingDocuments(documents)
                ? "Auto-refreshing every 3 seconds while ingestion is active."
                : "Uploaded files and ingestion results for the selected workspace."
            }
            action={
              <Button
                type="button"
                onClick={() => void loadDocuments({ showSpinner: true })}
                disabled={!selectedWorkspaceId}
                isLoading={isRefreshing}
                variant="secondary"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            }
          />

          {isLoadingDocuments || isLoadingWorkspaces ? (
            <LoadingSkeleton label="Loading documents" rows={4} />
          ) : documents.length === 0 ? (
            <EmptyState
              title="No documents found. Upload your first document."
              description="After upload, this table will show queued, processing, indexed, and failed states."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full divide-y divide-line text-sm">
                <thead className="bg-sunken text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  <tr>
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3">Processed</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {documents.map((document) => (
                    <tr key={document.id} className="align-top">
                      <td className="max-w-[300px] px-4 py-3">
                        <p className="truncate font-medium text-fg">
                          {document.filename}
                        </p>
                        <p className="mt-1 text-xs uppercase text-fg-subtle">
                          {document.file_type || getExtension(document.filename)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid gap-2">
                          <StatusBadge status={document.status} />
                          <p className="max-w-[260px] text-xs leading-5 text-fg-subtle">
                            {statusDetails[document.status].description}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                        {formatBytes(document.file_size)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                        {formatDate(document.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                        {formatDate(document.processed_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleViewStatus(document)}
                            isLoading={statusCheckingId === document.id}
                          >
                            View status
                          </Button>
                          {canUseAdminActions && document.status === "failed" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleRetry(document)}
                              isLoading={retryingId === document.id}
                            >
                              Retry
                            </Button>
                          ) : null}
                          {canUseAdminActions ? (
                            <Link
                              href={`/admin/ragops/documents/${document.id}`}
                              className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                            >
                              Pipeline
                            </Link>
                          ) : null}
                          {document.status !== "deleted" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setPendingDeleteId(document.id)}
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
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="Delete document"
        description="This removes the document from the workspace. It will no longer be available for retrieval."
        isOpen={Boolean(pendingDeleteId)}
        isSubmitting={isDeleting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void handleDeleteConfirmed()}
        title="Delete document?"
      />
    </DashboardShell>
  );
}
