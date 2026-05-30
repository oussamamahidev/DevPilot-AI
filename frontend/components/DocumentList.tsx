import type { Document } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, LoadingSkeleton, StatusBadge } from "@/components/ui";

function fmtBytes(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(v) / Math.log(1024)), units.length - 1);
  const amount = v / 1024 ** exp;
  return `${amount.toFixed(amount >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function fmtDate(v: string) {
  try {
    const diff = (Date.now() - new Date(v).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(v));
  } catch { return v; }
}

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function FileIcon({ filename }: { filename: string }) {
  const e = ext(filename);
  if (e === ".pdf") return <Icon name="filePdf" size={16} className="text-danger-fg" />;
  if (e === ".txt") return <Icon name="fileText" size={16} className="text-info-fg" />;
  return <Icon name="fileText" size={16} className="text-brand-fg" />;
}

type DocumentListProps = {
  documents: Document[];
  isLoading?: boolean;
  onDelete?: (documentId: string) => void;
};

export function DocumentList({ documents, isLoading = false, onDelete }: DocumentListProps) {
  if (isLoading) {
    return <LoadingSkeleton label="Loading documents" rows={3} />;
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents uploaded yet"
        description="Upload documents to enable RAG chat for this workspace."
      />
    );
  }

  return (
    <div className="grid gap-2">
      {documents.map((doc) => {
        const isIndexed = doc.status === "indexed";
        const isFailed = doc.status === "failed";
        return (
          <div
            key={doc.id}
            className={`flex items-center gap-3 rounded-lg border bg-surface px-3 py-2.5 ${isFailed ? "border-danger-line" : isIndexed ? "border-success-line" : "border-line"}`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isFailed ? "bg-danger-subtle" : isIndexed ? "bg-success-subtle" : "bg-sunken"}`}>
              <FileIcon filename={doc.filename} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{doc.filename}</p>
              <p className="text-xs text-fg-subtle">{fmtBytes(doc.file_size)} · {fmtDate(doc.created_at)}</p>
            </div>
            <StatusBadge status={doc.status} />
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(doc.id)}
                aria-label="Remove document"
                className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-danger-subtle hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Icon name="trash" size={13} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
