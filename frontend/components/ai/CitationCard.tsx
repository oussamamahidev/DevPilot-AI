import { Icon } from "@/components/ui/Icon";
import type { Citation, RagTraceCitation } from "@/types";

type CitationLike = Citation | RagTraceCitation;

type CitationCardProps = {
  citation: CitationLike;
};

export function CitationCard({ citation }: CitationCardProps) {
  const num = "id" in citation ? citation.id : citation.rank;
  const score = Number(citation.score ?? 0);
  const scorePct = Math.round(score * 100);
  const content =
    "content" in citation && typeof citation.content === "string"
      ? citation.content
      : "content_preview" in citation
        ? String((citation as { content_preview?: unknown }).content_preview)
        : null;

  const quality = score >= 0.8 ? "success" : score >= 0.6 ? "warning" : "critical";
  const scoreColor = quality === "success" ? "text-success-fg" : quality === "warning" ? "text-warning-fg" : "text-danger-fg";
  const scoreBg   = quality === "success" ? "bg-success-subtle border-success-line" : quality === "warning" ? "bg-warning-subtle border-warning-line" : "bg-danger-subtle border-danger-line";

  return (
    <details className="group overflow-hidden rounded-xl border border-line bg-sunken">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
        {/* citation number */}
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle border border-brand-subtle-line text-[10px] font-bold text-brand-fg">
          {num}
        </span>
        {/* filename */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{citation.filename}</p>
          <p className="mt-0.5 text-[10px] text-fg-subtle">
            Chunk {citation.chunk_index}
          </p>
        </div>
        {/* score badge */}
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${scoreBg} ${scoreColor}`}>
          {scorePct}%
        </span>
        {/* expand icon */}
        <Icon
          name="chevronDown"
          size={14}
          className="shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
        />
      </summary>

      {content ? (
        <div className="border-t border-line">
          <div className="flex items-center gap-1.5 px-4 pb-1 pt-3">
            <Icon name="fileText" size={12} className="text-fg-subtle" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Source preview
            </p>
          </div>
          <p className="px-4 pb-4 pt-1 whitespace-pre-wrap break-words text-xs leading-5 text-fg-muted">
            {content}
          </p>
        </div>
      ) : null}
    </details>
  );
}
