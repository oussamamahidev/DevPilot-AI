"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton, Select } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { retryRagOpsDocument } from "@/lib/admin";
import { removeToken } from "@/lib/auth";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import { deleteDocument, getDocumentStatus, listDocuments, uploadDocument } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { listWorkspaces } from "@/lib/workspaces";
import type { Document, DocumentStatus, Workspace } from "@/types";

/* ─── constants ─────────────────────────────────────────────── */
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"];
const ACCEPTED_MIME = "application/pdf,text/plain,text/markdown";

/* ─── helpers ────────────────────────────────────────────────── */
function fmtBytes(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(v) / Math.log(1024)), units.length - 1);
  const amount = v / 1024 ** exp;
  return `${amount.toFixed(amount >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
  } catch {
    return null;
  }
}

function fmtRelDate(v: string | null | undefined) {
  if (!v) return null;
  try {
    const diff = (Date.now() - new Date(v).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return fmtDate(v);
  } catch { return null; }
}

function ext(filename: string) {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

function validateFile(f: File): string | null {
  if (f.size > MAX_BYTES) return `Too large — max ${fmtBytes(MAX_BYTES)}`;
  if (!ACCEPTED_EXTENSIONS.includes(ext(f.name))) return "Unsupported format";
  return null;
}

function requestErrMsg(e: unknown, fallback: string) {
  if (e instanceof ApiRequestError || e instanceof ApiConnectionError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

function hasInFlight(docs: Document[]) {
  return docs.some((d) => ["queued", "processing", "uploaded"].includes(d.status));
}

function isAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

/* ─── batch-upload queue types ──────────────────────────────── */
type UploadState = "pending" | "uploading" | "done" | "error";
type QueuedFile = {
  id: string;
  file: File;
  validationError: string | null;
  state: UploadState;
  progress: number;
  errorMsg?: string;
};

/* ─── pipeline visualization ────────────────────────────────── */
type PipelineStep = { label: string; status: "done" | "active" | "error" | "waiting" };

function getSteps(status: DocumentStatus): PipelineStep[] {
  const s = status;
  return [
    { label: "Uploaded", status: "done" },
    {
      label: "Queued",
      status:
        s === "uploaded" ? "active"
        : s === "queued" || s === "processing" || s === "indexed" ? "done"
        : s === "failed" ? "done"
        : "waiting",
    },
    {
      label: "Processing",
      status:
        s === "queued" ? "active"
        : s === "processing" ? "active"
        : s === "indexed" ? "done"
        : s === "failed" ? "error"
        : "waiting",
    },
    {
      label: "Indexed",
      status: s === "indexed" ? "done" : s === "failed" ? "error" : "waiting",
    },
  ];
}

/* ─── file-type icon / color ────────────────────────────────── */
function FileIcon({ filename }: { filename: string }) {
  const e = ext(filename);
  if (e === ".pdf") return <Icon name="filePdf" size={20} className="text-danger-fg" />;
  if (e === ".txt") return <Icon name="fileText" size={20} className="text-info-fg" />;
  return <Icon name="fileText" size={20} className="text-brand-fg" />;
}

/* ─── filter tabs ────────────────────────────────────────────── */
type FilterKey = "all" | "indexed" | "processing" | "failed";

/* ─────────────────────────────────────────────────────────────── */
/* PAGE                                                            */
/* ─────────────────────────────────────────────────────────────── */
export default function DocumentsPage() {
  const router = useRouter();
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();

  /* workspace */
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWsId, setSelectedWsId] = useState("");
  const [isLoadingWs, setIsLoadingWs] = useState(true);

  /* documents */
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* upload queue */
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* actions */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [statusCheckingId, setStatusCheckingId] = useState<string | null>(null);

  /* ui */
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "danger" } | null>(null);

  const selectedWs = workspaces.find((w) => w.id === selectedWsId);
  const canAdmin = isAdmin(user?.role);

  /* ── computed ── */
  const stats = useMemo(() => {
    const active = documents.filter((d) => d.status !== "deleted");
    return {
      total: active.length,
      indexed: active.filter((d) => d.status === "indexed").length,
      processing: active.filter((d) => ["processing", "queued", "uploaded"].includes(d.status)).length,
      failed: active.filter((d) => d.status === "failed").length,
    };
  }, [documents]);

  const filtered = useMemo(() => {
    const active = documents.filter((d) => d.status !== "deleted");
    if (filter === "indexed") return active.filter((d) => d.status === "indexed");
    if (filter === "processing") return active.filter((d) => ["processing", "queued", "uploaded"].includes(d.status));
    if (filter === "failed") return active.filter((d) => d.status === "failed");
    return active;
  }, [documents, filter]);

  const validQueue = useMemo(() => queue.filter((q) => !q.validationError), [queue]);
  const isUploading = queue.some((q) => q.state === "uploading");
  const uploadDone = queue.length > 0 && queue.every((q) => q.state === "done" || (q.validationError != null));

  /* ── toast helper ── */
  function showToast(msg: string, tone: "success" | "danger") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4000);
  }

  /* ── load workspaces ── */
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setIsLoadingWs(true);
    listWorkspaces()
      .then((res) => {
        if (!mounted) return;
        setWorkspaces(res);
        setSelectedWsId((c) => c || res[0]?.id || "");
      })
      .catch((e) => {
        if (!mounted) return;
        if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return; }
        setError(requestErrMsg(e, "Unable to load workspaces."));
      })
      .finally(() => { if (mounted) setIsLoadingWs(false); });
    return () => { mounted = false; };
  }, [user, router]);

  /* ── load documents ── */
  const loadDocs = useCallback(async ({ spinner = false }: { spinner?: boolean } = {}) => {
    if (!selectedWsId) { setDocuments([]); return; }
    if (spinner) setIsRefreshing(true); else setIsLoadingDocs(true);
    try {
      const res = await listDocuments(selectedWsId);
      setDocuments(res);
      setError(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return; }
      if (e instanceof ApiRequestError && e.status === 403) { setError(COMMON_ERROR_MESSAGES.forbidden); return; }
      setError(requestErrMsg(e, "Unable to load documents."));
    } finally {
      setIsLoadingDocs(false);
      setIsRefreshing(false);
    }
  }, [selectedWsId, router]);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  /* ── auto-refresh when in-flight ── */
  useEffect(() => {
    if (!hasInFlight(documents)) return;
    const id = window.setInterval(() => void loadDocs({ spinner: true }), 3000);
    return () => window.clearInterval(id);
  }, [documents, loadDocs]);

  /* ── queue file helpers ── */
  function addFiles(files: File[]) {
    const next: QueuedFile[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      validationError: validateFile(file),
      state: "pending",
      progress: 0,
    }));
    setQueue((c) => {
      const existingNames = new Set(c.map((q) => `${q.file.name}-${q.file.size}`));
      return [...c, ...next.filter((n) => !existingNames.has(`${n.file.name}-${n.file.size}`))];
    });
  }

  function removeFromQueue(id: string) {
    setQueue((c) => c.filter((q) => q.id !== id));
  }

  function clearQueue() { setQueue([]); }

  /* ── drag-drop ── */
  function onDragOver(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }
  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  }

  /* ── batch upload ── */
  async function handleUpload() {
    if (!selectedWsId) { setError("Select a workspace first."); return; }
    const toUpload = queue.filter((q) => q.state === "pending" && !q.validationError);
    if (toUpload.length === 0) return;

    for (const item of toUpload) {
      setQueue((c) => c.map((q) => q.id === item.id ? { ...q, state: "uploading", progress: 10 } : q));

      // animate progress
      const tick = window.setInterval(() => {
        setQueue((c) => c.map((q) => q.id === item.id && q.state === "uploading" ? { ...q, progress: Math.min(q.progress + 8, 85) } : q));
      }, 300);

      try {
        const doc = await uploadDocument(selectedWsId, item.file);
        window.clearInterval(tick);
        setQueue((c) => c.map((q) => q.id === item.id ? { ...q, state: "done", progress: 100 } : q));
        setDocuments((c) => [doc, ...c.filter((d) => d.id !== doc.id)]);
      } catch (e) {
        window.clearInterval(tick);
        const msg = requestErrMsg(e, "Upload failed.");
        setQueue((c) => c.map((q) => q.id === item.id ? { ...q, state: "error", progress: 0, errorMsg: msg } : q));
      }
    }

    await loadDocs({ spinner: true });
    showToast(`${toUpload.length} file${toUpload.length > 1 ? "s" : ""} uploaded.`, "success");
  }

  /* ── actions ── */
  async function handleViewStatus(doc: Document) {
    setStatusCheckingId(doc.id);
    try {
      const res = await getDocumentStatus(doc.id);
      setDocuments((c) => c.map((d) => d.id === doc.id ? { ...d, status: res.status } : d));
    } catch (e) {
      showToast(requestErrMsg(e, "Unable to fetch status."), "danger");
    } finally { setStatusCheckingId(null); }
  }

  async function handleRetry(doc: Document) {
    setRetryingId(doc.id);
    try {
      await retryRagOpsDocument(doc.id, "Retry requested from documents page");
      await loadDocs({ spinner: true });
      showToast(`${doc.filename} retry requested.`, "success");
    } catch (e) {
      showToast(requestErrMsg(e, "Retry unavailable."), "danger");
    } finally { setRetryingId(null); }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteDocument(pendingDeleteId);
      setDocuments((c) => c.filter((d) => d.id !== pendingDeleteId));
      setPendingDeleteId(null);
      showToast("Document deleted.", "success");
    } catch (e) {
      showToast(requestErrMsg(e, "Unable to delete."), "danger");
    } finally { setIsDeleting(false); }
  }

  /* ── auth loading ── */
  if (isAuthLoading) {
    return (
      <DashboardShell activeItem="documents" title="Documents">
        <LoadingSkeleton label="Checking authentication" rows={4} />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell activeItem="documents" title="Documents">
        <ErrorState message={authError ?? "Session expired."} title="Unable to load documents"
          action={<Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>} />
      </DashboardShell>
    );
  }

  /* ─────────── render ─────────── */
  return (
    <DashboardShell activeItem="documents" title="Documents">

      {/* toast */}
      {toast ? (
        <div className={`fixed bottom-6 right-6 z-[1500] max-w-sm animate-dp-slide-up rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${toast.tone === "success" ? "border-success-line bg-success-subtle text-success-surface-fg" : "border-danger-line bg-danger-subtle text-danger-surface-fg"}`}>
          {toast.msg}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6">
        {error ? (
          <ErrorState message={error} action={<Button variant="secondary" size="sm" onClick={() => void loadDocs({ spinner: true })}>Retry</Button>} />
        ) : null}

        {/* ── workspace picker + stats ──────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Select
              value={selectedWsId}
              onChange={(e) => { setSelectedWsId(e.target.value); setError(null); }}
              disabled={isLoadingWs || workspaces.length === 0}
              containerClassName="min-w-48"
              label="Workspace"
            >
              {workspaces.length === 0 ? <option value="">No workspaces</option> : null}
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </Select>
            {selectedWs && (
              <Link
                href={`/workspaces/${selectedWs.id}/chat`}
                className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Icon name="message" size={15} />
                Chat
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "total", label: "Total", value: stats.total, cls: "text-fg" },
              { key: "indexed", label: "Ready", value: stats.indexed, cls: "text-success-fg" },
              { key: "processing", label: "Processing", value: stats.processing, cls: "text-info-fg" },
              { key: "failed", label: "Failed", value: stats.failed, cls: "text-danger-fg" },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5">
                <span className={`text-xl font-semibold tabular-nums ${s.cls}`}>{s.value}</span>
                <span className="text-xs text-fg-subtle">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {workspaces.length === 0 && !isLoadingWs ? (
          <EmptyState
            title="Create a workspace first"
            description="Documents are scoped to workspaces so retrieval stays isolated."
            action={
              <Link href="/dashboard#create-workspace"
                className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                Create workspace
              </Link>
            }
          />
        ) : null}

        {/* ── upload zone ──────────────────────────────────── */}
        {selectedWsId ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <p className="text-sm font-semibold text-fg">Upload Documents</p>
              <p className="text-xs text-fg-muted">Drag files or click to browse · PDF, TXT, Markdown · max {fmtBytes(MAX_BYTES)} each</p>
            </div>

            {/* drop zone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`mx-4 mt-4 cursor-pointer rounded-xl border-2 border-dashed transition ${isDragging ? "border-brand bg-brand-subtle" : "border-line bg-sunken hover:border-line-strong"}`}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload documents"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_MIME}
                multiple
                className="sr-only"
                onChange={onFileInput}
              />
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <span className={`grid h-14 w-14 place-items-center rounded-full ${isDragging ? "bg-brand text-white" : "bg-surface text-fg-subtle"}`}>
                  <Icon name="cloudUpload" size={26} />
                </span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-fg">
                    {isDragging ? "Drop to add files" : "Drop files here or click to browse"}
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">Supports multiple files at once</p>
                </div>
              </div>
            </div>

            {/* queue list */}
            {queue.length > 0 ? (
              <div className="grid gap-2 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {queue.length} file{queue.length > 1 ? "s" : ""} queued
                  </p>
                  {uploadDone ? (
                    <button onClick={clearQueue} className="text-xs text-fg-muted hover:text-fg focus-visible:outline-none">
                      Clear
                    </button>
                  ) : null}
                </div>

                {queue.map((item) => (
                  <QueueRow key={item.id} item={item} onRemove={() => removeFromQueue(item.id)} />
                ))}

                {!uploadDone ? (
                  <Button
                    onClick={() => void handleUpload()}
                    isLoading={isUploading}
                    disabled={validQueue.filter((q) => q.state === "pending").length === 0}
                    className="mt-1"
                  >
                    <Icon name="cloudUpload" size={15} />
                    {isUploading
                      ? `Uploading ${queue.filter((q) => q.state === "uploading").length > 0 ? queue.filter((q) => q.state === "uploading")[0]!.file.name : "…"}`
                      : `Upload ${validQueue.filter((q) => q.state === "pending").length} file${validQueue.filter((q) => q.state === "pending").length !== 1 ? "s" : ""}`}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-success-line bg-success-subtle px-3 py-2 text-sm text-success-surface-fg">
                    <Icon name="checkCircle" size={15} />
                    All files uploaded — document ingestion is running.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── documents grid ────────────────────────────────── */}
        {selectedWsId ? (
          <div>
            {/* filter tabs + refresh */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
                {([
                  ["all", "All", stats.total],
                  ["indexed", "Ready", stats.indexed],
                  ["processing", "Processing", stats.processing],
                  ["failed", "Failed", stats.failed],
                ] as [FilterKey, string, number][]).map(([k, label, count]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${filter === k ? "bg-brand text-white" : "text-fg-muted hover:bg-hover hover:text-fg"}`}
                  >
                    {label}
                    <span className={`rounded-full px-1.5 py-px text-[10px] ${filter === k ? "bg-white/20" : "bg-sunken"}`}>{count}</span>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" isLoading={isRefreshing} onClick={() => void loadDocs({ spinner: true })} disabled={!selectedWsId}>
                <Icon name="refreshCw" size={14} />
                {isRefreshing ? "Refreshing" : "Refresh"}
              </Button>
            </div>

            {hasInFlight(documents) ? (
              <div className="mb-3 flex items-center gap-2 text-xs text-warning-surface-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-warning motion-safe:animate-pulse" />
                Processing documents auto-refresh every 3 s
              </div>
            ) : null}

            {isLoadingDocs || isLoadingWs ? (
              <LoadingSkeleton rows={3} variant="card" />
            ) : filtered.length === 0 ? (
              <EmptyState
                title={filter === "all" ? "No documents yet — upload your first file above." : `No ${filter === "indexed" ? "ready" : filter} documents.`}
                description={filter === "all" ? "Drag-and-drop or click the upload zone to get started." : `Switch to "All" to see every document.`}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    canAdmin={canAdmin}
                    isStatusChecking={statusCheckingId === doc.id}
                    isRetrying={retryingId === doc.id}
                    onStatusCheck={() => void handleViewStatus(doc)}
                    onRetry={() => void handleRetry(doc)}
                    onDelete={() => setPendingDeleteId(doc.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel="Delete document"
        description="This removes the document from the workspace and it will no longer be available for retrieval."
        isOpen={Boolean(pendingDeleteId)}
        isSubmitting={isDeleting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void handleDelete()}
        title="Delete document?"
      />
    </DashboardShell>
  );
}

/* ─── QueueRow ───────────────────────────────────────────────── */
function QueueRow({ item, onRemove }: { item: QueuedFile; onRemove: () => void }) {
  const { file, state, progress, validationError, errorMsg } = item;
  const isError = Boolean(validationError) || state === "error";
  const isDone = state === "done";
  const isActive = state === "uploading";

  return (
    <div className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 ${isError ? "border-danger-line bg-danger-subtle" : isDone ? "border-success-line bg-success-subtle" : "border-line bg-sunken"}`}>
      <div className="flex items-center gap-2">
        <FileIcon filename={file.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{file.name}</p>
          <p className="text-xs text-fg-subtle">{fmtBytes(file.size)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDone ? (
            <Icon name="checkCircle" size={16} className="text-success-fg" />
          ) : isError ? (
            <Icon name="alertCircle" size={16} className="text-danger-fg" />
          ) : isActive ? (
            <span className="h-3 w-3 rounded-full border-2 border-brand border-t-transparent motion-safe:animate-spin" />
          ) : null}
          {state !== "uploading" && (
            <button onClick={onRemove} aria-label="Remove" className="rounded text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      {isActive ? (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {validationError ? (
        <p className="text-xs font-medium text-danger-fg">{validationError}</p>
      ) : null}
      {errorMsg && !validationError ? (
        <p className="text-xs font-medium text-danger-fg">{errorMsg}</p>
      ) : null}
    </div>
  );
}

/* ─── DocumentCard ───────────────────────────────────────────── */
function DocumentCard({
  doc,
  canAdmin,
  isStatusChecking,
  isRetrying,
  onStatusCheck,
  onRetry,
  onDelete,
}: {
  doc: Document;
  canAdmin: boolean;
  isStatusChecking: boolean;
  isRetrying: boolean;
  onStatusCheck: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const steps = getSteps(doc.status);
  const uploadedAt = fmtRelDate(doc.created_at);
  const processedAt = doc.processed_at ? fmtDate(doc.processed_at) : null;
  const isFailed = doc.status === "failed";
  const isIndexed = doc.status === "indexed";

  return (
    <div className={`flex flex-col rounded-xl border bg-surface shadow-sm transition ${isFailed ? "border-danger-line" : isIndexed ? "border-success-line" : "border-line"}`}>
      {/* header */}
      <div className="flex items-start gap-3 p-4">
        <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isFailed ? "bg-danger-subtle" : isIndexed ? "bg-success-subtle" : "bg-sunken"}`}>
          <FileIcon filename={doc.filename} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg" title={doc.filename}>{doc.filename}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-line bg-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase text-fg-subtle">
              {doc.file_type || "FILE"}
            </span>
            <span className="text-xs text-fg-subtle">{fmtBytes(doc.file_size)}</span>
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {/* pipeline stepper */}
      <div className="border-t border-line bg-sunken px-4 py-3">
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                {i > 0 ? (
                  <div className={`h-px flex-1 ${steps[i - 1]?.status === "done" ? "bg-success" : "bg-line"}`} />
                ) : null}
                <span
                  className={`z-10 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                    step.status === "done"
                      ? "bg-success text-white"
                      : step.status === "active"
                        ? "bg-brand text-white"
                        : step.status === "error"
                          ? "bg-danger text-white"
                          : "bg-line text-fg-subtle"
                  }`}
                >
                  {step.status === "done" ? "✓" : step.status === "error" ? "✕" : i + 1}
                </span>
                {i < steps.length - 1 ? (
                  <div className={`h-px flex-1 ${step.status === "done" ? "bg-success" : "bg-line"}`} />
                ) : null}
              </div>
              <span className="text-[9px] text-fg-subtle">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* meta */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-fg-subtle">
        {uploadedAt ? <span>Uploaded {uploadedAt}</span> : null}
        {processedAt ? <span>Processed {processedAt}</span> : null}
      </div>

      {/* actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-line px-4 py-3">
        <Button size="sm" variant="ghost" onClick={onStatusCheck} isLoading={isStatusChecking} className="text-xs">
          <Icon name="refreshCw" size={13} />
          Refresh
        </Button>
        {canAdmin && isFailed ? (
          <Button size="sm" variant="secondary" onClick={onRetry} isLoading={isRetrying} className="text-xs">
            Retry
          </Button>
        ) : null}
        {canAdmin && !isFailed ? (
          <Link href={`/admin/ragops/documents/${doc.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Icon name="activity" size={13} />
            Pipeline
          </Link>
        ) : null}
        {doc.status !== "deleted" ? (
          <button
            onClick={onDelete}
            aria-label="Delete document"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition hover:bg-danger-subtle hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Icon name="trash" size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
