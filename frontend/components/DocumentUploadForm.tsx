"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { uploadDocument } from "@/lib/documents";
import type { Document } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = [".pdf", ".txt", ".md", ".markdown"];

function fmtBytes(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(v) / Math.log(1024)), units.length - 1);
  const amount = v / 1024 ** exp;
  return `${amount.toFixed(amount >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function validateFile(f: File): string | null {
  if (f.size > MAX_BYTES) return `Too large — max ${fmtBytes(MAX_BYTES)}`;
  if (!ACCEPTED.includes(ext(f.name))) return "Unsupported format. Use PDF, TXT, or Markdown.";
  return null;
}

type FileState = "idle" | "uploading" | "done" | "error";

type DocumentUploadFormProps = {
  onUploadStarted?: () => void;
  onUploaded: (document: Document) => Promise<void> | void;
  workspaceId: string;
};

export function DocumentUploadForm({ onUploadStarted, onUploaded, workspaceId }: DocumentUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileState, setFileState] = useState<FileState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setFile(f);
    setFileError(f ? validateFile(f) : null);
    setFileState("idle");
    setProgress(0);
    setError(null);
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    pick(e.target.files?.[0] ?? null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    pick(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleUpload() {
    const err = file ? validateFile(file) : "Choose a file first.";
    if (err || !file) { setFileError(err); return; }

    setError(null);
    setFileState("uploading");
    setProgress(10);
    onUploadStarted?.();

    const tick = window.setInterval(() => {
      setProgress((c) => Math.min(c + 8, 85));
    }, 300);

    try {
      const doc = await uploadDocument(workspaceId, file);
      window.clearInterval(tick);
      setProgress(100);
      setFileState("done");
      setFile(null);
      await onUploaded(doc);
    } catch (e) {
      window.clearInterval(tick);
      setProgress(0);
      setFileState("error");
      if (e instanceof ApiRequestError) setError(e.message);
      else if (e instanceof ApiConnectionError) setError("Cannot reach the API.");
      else setError("Upload failed.");
    }
  }

  const isDone = fileState === "done";
  const isUploading = fileState === "uploading";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-fg">Upload Document</p>
        <p className="text-xs text-fg-muted">PDF, TXT, Markdown · max {fmtBytes(MAX_BYTES)}</p>
      </div>

      <div className="p-4">
        {/* drop zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          aria-label="Upload document"
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition ${isDragging ? "border-brand bg-brand-subtle" : file ? "border-success-line bg-success-subtle" : "border-line bg-sunken hover:border-line-strong"}`}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} className="sr-only" onChange={onFileInput} />
          <span className={`grid h-10 w-10 place-items-center rounded-full ${file && !fileError ? "bg-success text-white" : "bg-surface text-fg-subtle"}`}>
            {file && !fileError ? (
              <Icon name="checkCircle" size={20} />
            ) : (
              <Icon name="cloudUpload" size={20} />
            )}
          </span>
          {file ? (
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-fg">{file.name}</p>
              <p className="text-xs text-fg-subtle">{fmtBytes(file.size)}</p>
            </div>
          ) : (
            <div className="mt-2 text-center">
              <p className="text-sm font-medium text-fg">Drop a file or click to browse</p>
              <p className="mt-0.5 text-xs text-fg-subtle">PDF · TXT · Markdown</p>
            </div>
          )}
        </div>

        {fileError ? (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-danger-fg">
            <Icon name="alertCircle" size={12} />
            {fileError}
          </p>
        ) : null}

        {/* progress */}
        {isUploading ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-fg-subtle">
              <span>Uploading {file?.name}…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {isDone ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-success-line bg-success-subtle px-3 py-2 text-xs text-success-surface-fg">
            <Icon name="checkCircle" size={14} />
            Uploaded — ingestion is running.
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger-line bg-danger-subtle px-3 py-2 text-xs text-danger-surface-fg">
            <Icon name="alertCircle" size={14} />
            {error}
          </div>
        ) : null}

        <Button
          onClick={() => void handleUpload()}
          isLoading={isUploading}
          disabled={!file || Boolean(fileError)}
          className="mt-3 w-full"
        >
          <Icon name="cloudUpload" size={15} />
          {isUploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </div>
  );
}
