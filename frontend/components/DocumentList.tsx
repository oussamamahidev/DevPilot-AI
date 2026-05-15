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

function statusClass(status: Document["status"]) {
  if (status === "indexed") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-800";
  }

  if (status === "queued" || status === "processing") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

export function DocumentList({
  documents,
  isLoading = false,
  onDelete,
}: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {documents.map((document) => (
              <tr key={document.id}>
                <td className="max-w-[280px] truncate px-4 py-3 font-medium text-slate-950">
                  {document.filename}
                </td>
                <td className="px-4 py-3 text-slate-600">{document.file_type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                      document.status,
                    )}`}
                  >
                    {document.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatDate(document.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(document.id)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
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
