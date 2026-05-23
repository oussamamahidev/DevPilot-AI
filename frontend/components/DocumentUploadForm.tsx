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
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          Upload document
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          PDF, TXT, and Markdown files are supported.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          type="file"
          accept={acceptedTypes}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-md border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isUploading}
          className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? "Uploading..." : "Upload document"}
        </button>
      </div>
    </form>
  );
}
