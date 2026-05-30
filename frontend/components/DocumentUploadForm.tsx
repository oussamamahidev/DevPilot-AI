"use client";

import { FormEvent, useState } from "react";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { uploadDocument } from "@/lib/documents";
import type { Document } from "@/types";

type DocumentUploadFormProps = {
  onUploadStarted?: () => void;
  onUploaded: (document: Document) => Promise<void> | void;
  workspaceId: string;
};

const acceptedTypes = ".pdf,.txt,.md,.markdown";

export function DocumentUploadForm({
  onUploadStarted,
  onUploaded,
  workspaceId,
}: DocumentUploadFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (!file) {
      setError("Choose a PDF, TXT, or Markdown file.");
      return;
    }

    onUploadStarted?.();
    setIsUploading(true);

    try {
      const form = event.currentTarget;
      const document = await uploadDocument(workspaceId, file);

      setError(null);
      setFile(null);
      setSuccess(`${document.filename} uploaded and queued for processing.`);
      form.reset();
      await onUploaded(document);
    } catch (requestError) {
      setSuccess(null);

      if (requestError instanceof ApiRequestError) {
        setError(requestError.message);
      } else if (requestError instanceof ApiConnectionError) {
        setError("Unable to upload the document. Check that the API is running.");
      } else {
        setError("Unable to upload the document.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-line bg-surface p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-fg">
          Upload document
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          PDF, TXT, and Markdown files are supported.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          type="file"
          accept={acceptedTypes}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-md border border-line-strong bg-surface text-sm text-fg-muted file:mr-4 file:border-0 file:bg-brand file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        />

        {error ? (
          <div className="rounded-md border border-danger-line bg-danger-subtle px-4 py-3 text-sm text-danger-surface-fg">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-md border border-success-line bg-success-subtle px-4 py-3 text-sm text-success-surface-fg">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isUploading}
          className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {isUploading ? "Uploading..." : "Upload document"}
        </button>
      </div>
    </form>
  );
}
