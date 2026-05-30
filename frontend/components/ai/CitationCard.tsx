import { Card } from "@/components/ui/Card";
import type { Citation, RagTraceCitation } from "@/types";

type CitationLike = Citation | RagTraceCitation;

type CitationCardProps = {
  citation: CitationLike;
};

export function CitationCard({ citation }: CitationCardProps) {
  const citationNumber = "id" in citation ? citation.id : citation.rank;
  const content =
    "content" in citation && typeof citation.content === "string"
      ? citation.content
      : "content_preview" in citation
        ? String(citation.content_preview)
        : null;

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span className="font-semibold text-fg">[{citationNumber}]</span>
        <span className="max-w-full truncate font-medium">{citation.filename}</span>
        <span>Chunk {citation.chunk_index}</span>
        <span>Score {Number(citation.score ?? 0).toFixed(3)}</span>
      </div>
      {content ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg">
            Preview
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-sunken p-3 text-xs leading-5 text-fg-muted">
            {content}
          </p>
        </details>
      ) : null}
    </Card>
  );
}
