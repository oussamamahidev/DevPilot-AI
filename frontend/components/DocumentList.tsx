import { Button, EmptyState, LoadingSkeleton, StatusBadge } from "@/components/ui";
import type { Document } from "@/types";

type DocumentListProps = {
  documents: Document[];
  isLoading?: boolean;
  onDelete?: (documentId: string) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DocumentList({
  documents,
  isLoading = false,
  onDelete,
}: DocumentListProps) {
  if (isLoading) {
    return <LoadingSkeleton label="Loading documents" rows={3} />;
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents uploaded yet"
        description="Upload documents to create searchable chunks and enable RAG chat."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-sunken text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {documents.map((document) => (
              <tr key={document.id}>
                <td className="max-w-[280px] truncate px-4 py-3 font-medium text-fg">
                  {document.filename}
                </td>
                <td className="px-4 py-3 text-fg-muted">{document.file_type}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={document.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                  {formatDate(document.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {onDelete ? (
                    <Button
                      type="button"
                      onClick={() => onDelete(document.id)}
                      size="sm"
                      variant="secondary"
                    >
                      Remove
                    </Button>
                  ) : (
                    <span className="text-xs text-fg-subtle">None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
