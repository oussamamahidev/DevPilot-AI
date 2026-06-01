"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  Section,
  CopyButton,
  ScoreBar,
  ToneBadge,
  KeyVal,
  Panel,
} from "@/features/trace-inspector/components/primitives";
import {
  rankChange,
  splitAnswerByCitations,
  formatLatency,
  safePreview,
  fmtNumber,
  type RankChange,
  type Tone,
} from "@/features/trace-inspector/helpers";
import type {
  RagTraceDetail,
  RagTraceRetrievalDetails,
  RagTraceRetrievedChunk,
  RagTraceRerankingDetails,
  RagTraceRerankingItem,
  RagTraceCitation,
} from "@/types";

/* ─── local utilities (no fabrication — pure presentation) ──────── */
function clamp01(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function fileIcon(filename: string): IconName {
  return filename.toLowerCase().endsWith(".pdf") ? "filePdf" : "fileText";
}

/* Anchor that lets us scroll a citation card into view when activated. */

/* ════════════════════════════════════════════════════════════════
   3) RETRIEVAL EXPLORER
   ════════════════════════════════════════════════════════════════ */
export function RetrievalExplorer({
  trace,
  retrieval,
}: {
  trace: RagTraceDetail;
  retrieval: RagTraceRetrievalDetails | undefined;
}) {
  const chunks = retrieval?.chunks ?? trace.retrieved_chunks;
  const sorted = [...chunks].sort((a, b) => a.rank - b.rank);

  const originalQuery = retrieval?.original_query ?? trace.question;
  const rewrittenQuery = retrieval?.rewritten_query ?? "Not rewritten";
  const strategy = retrieval?.retrieval_strategy ?? trace.retrieval_strategy ?? "—";
  const retrievalLatency = formatLatency(trace.latency_summary.by_agent_type["retrieval"]);

  return (
    <Section
      id="retrieval"
      num={3}
      icon="search"
      title="Retrieval Explorer"
      subtitle="Candidate chunks fetched from the vector store"
      actions={
        <ToneBadge
          tone="neutral"
          label={`${fmtNumber(sorted.length)} ${sorted.length === 1 ? "chunk" : "chunks"}`}
          icon="layers"
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        {/* Query panels */}
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel
            title="Original query"
            action={originalQuery ? <CopyButton text={originalQuery} label="Copy" size="xs" /> : undefined}
          >
            <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-fg">
              {originalQuery && originalQuery.trim() !== "" ? originalQuery : "—"}
            </p>
          </Panel>
          <Panel title="Rewritten query">
            <p
              className={`min-w-0 whitespace-pre-wrap break-words text-sm ${
                retrieval?.rewritten_query ? "text-fg" : "italic text-fg-subtle"
              }`}
            >
              {rewrittenQuery}
            </p>
          </Panel>
        </div>

        {/* Meta */}
        <div className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border border-line bg-sunken p-3 sm:grid-cols-3">
          <KeyVal label="Strategy" value={strategy} />
          <KeyVal label="Retrieval latency" value={retrievalLatency} />
          <KeyVal label="Candidates" value={fmtNumber(sorted.length)} />
        </div>

        {/* Chunk grid */}
        {sorted.length === 0 ? (
          <Panel>
            <div className="flex min-w-0 flex-col items-center gap-2 py-6 text-center">
              <Icon name="search" size={20} className="text-fg-subtle" aria-hidden="true" />
              <p className="text-sm font-medium text-fg">No chunks were retrieved</p>
              <p className="text-xs text-fg-subtle">
                The retriever returned no candidates for this query.
              </p>
            </div>
          </Panel>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((chunk) => (
              <RetrievedChunkCard key={chunk.chunk_id ?? `${chunk.filename}-${chunk.rank}`} chunk={chunk} trace={trace} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function RetrievedChunkCard({ chunk, trace }: { chunk: RagTraceRetrievedChunk; trace: RagTraceDetail }) {
  const cited = trace.citations.some(
    (c) => c.chunk_id && chunk.chunk_id && c.chunk_id === chunk.chunk_id,
  );
  const subScores = Object.entries(chunk.source_scores ?? {});
  const preview = safePreview(chunk.content ?? chunk.content_preview, 220);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-sm">
      {/* Header */}
      <div className="flex min-w-0 items-start gap-2">
        <span className="grid h-6 w-7 shrink-0 place-items-center rounded-md bg-brand-subtle text-[11px] font-bold tabular-nums text-brand-fg">
          #{chunk.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name={fileIcon(chunk.filename)} size={13} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm font-medium text-fg" title={chunk.filename}>
              {chunk.filename}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-subtle">chunk {chunk.chunk_index}</p>
        </div>
        <ToneBadge
          tone={cited ? "success" : "neutral"}
          label={cited ? "Cited" : "Retrieved"}
          icon={cited ? "checkCircle" : "eye"}
        />
      </div>

      {/* Scores */}
      <div className="flex min-w-0 flex-col gap-2">
        <ScoreBar label="Score" value={clamp01(chunk.score)} />
        {subScores.map(([name, value]) => (
          <ScoreBar key={name} label={name} value={clamp01(value)} />
        ))}
      </div>

      {/* Preview */}
      <div className="min-w-0">
        <p className="min-w-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted">
          {preview}
        </p>
        {chunk.content ? (
          <details className="group mt-2 min-w-0">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-[11px] font-medium text-brand-fg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
              <Icon
                name="chevronRight"
                size={12}
                className="transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              Show full
            </summary>
            <div className="mt-2 max-h-72 min-w-0 overflow-y-auto rounded-md border border-line-subtle bg-sunken p-2">
              <p className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-fg">
                {chunk.content}
              </p>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   4) RERANKING EXPLORER
   ════════════════════════════════════════════════════════════════ */
const RANK_META: Record<RankChange, { label: string; tone: Tone; icon: IconName; rotate: string }> = {
  promoted: { label: "Promoted", tone: "success", icon: "arrowRight", rotate: "-rotate-45" },
  demoted: { label: "Demoted", tone: "danger", icon: "arrowRight", rotate: "rotate-45" },
  same: { label: "Unchanged", tone: "neutral", icon: "arrowRight", rotate: "" },
  new: { label: "New", tone: "info", icon: "arrowRight", rotate: "" },
  dropped: { label: "Dropped", tone: "danger", icon: "arrowRight", rotate: "" },
};

export function RerankingExplorer({ reranking }: { reranking: RagTraceRerankingDetails | undefined }) {
  const available = !!reranking && reranking.reranker_details_available;
  const items = reranking?.items ?? [];
  const sorted = [...items].sort((a, b) => {
    if (a.final_rank == null && b.final_rank == null) return 0;
    if (a.final_rank == null) return 1;
    if (b.final_rank == null) return -1;
    return a.final_rank - b.final_rank;
  });

  return (
    <Section
      id="reranking"
      num={4}
      icon="activity"
      title="Reranking Explorer"
      subtitle="How the cross-encoder changed chunk ranking"
      actions={
        items.length > 0 ? (
          <ToneBadge
            tone="neutral"
            label={`${fmtNumber(items.length)} ${items.length === 1 ? "item" : "items"}`}
            icon="layers"
          />
        ) : undefined
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        {!available ? (
          <Panel className="border-warning-line bg-warning-subtle">
            <div className="flex min-w-0 items-start gap-2">
              <Icon name="alertCircle" size={16} className="mt-0.5 shrink-0 text-warning-fg" aria-hidden="true" />
              <p className="min-w-0 break-words text-sm text-warning-surface-fg">
                Detailed reranker output was not stored for this trace — showing best-available ordering.
              </p>
            </div>
          </Panel>
        ) : null}

        {sorted.length === 0 ? (
          <Panel>
            <div className="flex min-w-0 flex-col items-center gap-2 py-6 text-center">
              <Icon name="activity" size={20} className="text-fg-subtle" aria-hidden="true" />
              <p className="text-sm font-medium text-fg">No reranking items recorded</p>
              <p className="text-xs text-fg-subtle">
                There is no reranked candidate ordering available for this trace.
              </p>
            </div>
          </Panel>
        ) : (
          <ul className="flex min-w-0 flex-col gap-2.5">
            {sorted.map((item, i) => (
              <RerankRow key={item.chunk_id ?? `${item.filename}-${i}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function RerankRow({ item }: { item: RagTraceRerankingItem }) {
  const change = rankChange(item);
  const meta = RANK_META[change];

  return (
    <li className="min-w-0 rounded-lg border border-line bg-surface p-3 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        {/* Rank transition */}
        <div className="flex shrink-0 items-center gap-2">
          <RankChip value={item.original_rank} title="Original rank" />
          <Icon
            name={meta.icon}
            size={16}
            className={`shrink-0 ${meta.rotate} ${
              meta.tone === "success"
                ? "text-success-fg"
                : meta.tone === "danger"
                  ? "text-danger-fg"
                  : meta.tone === "info"
                    ? "text-info-fg"
                    : "text-fg-subtle"
            }`}
            aria-hidden="true"
          />
          <RankChip value={item.final_rank} title="Final rank" />
          <ToneBadge tone={meta.tone} label={meta.label} />
        </div>

        {/* Filename + preview */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name={fileIcon(item.filename)} size={13} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm font-medium text-fg" title={item.filename}>
              {item.filename}
            </span>
          </div>
          <p className="mt-0.5 min-w-0 truncate text-xs text-fg-muted">
            {safePreview(item.content_preview, 110)}
          </p>
        </div>

        {/* Cited badge */}
        <div className="shrink-0">
          <ToneBadge
            tone={item.used_in_final_citations ? "success" : "neutral"}
            label={item.used_in_final_citations ? "Cited" : "Not used"}
            icon={item.used_in_final_citations ? "checkCircle" : "eye"}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-line-subtle pt-3 sm:grid-cols-4">
        <Metric label="Original score" value={item.original_score.toFixed(4)} />
        <Metric label="Rerank score" value={item.rerank_score == null ? "n/a" : item.rerank_score.toFixed(4)} />
        <Metric label="Exact matches" value={item.exact_matches == null ? "n/a" : fmtNumber(item.exact_matches)} />
        <Metric label="Overlap" value={item.overlap == null ? "n/a" : item.overlap.toFixed(4)} />
      </div>
    </li>
  );
}

function RankChip({ value, title }: { value: number | null; title: string }) {
  return (
    <span
      title={title}
      className="grid h-7 min-w-[2.25rem] place-items-center rounded-md border border-line bg-sunken px-1.5 text-xs font-bold tabular-nums text-fg"
    >
      #{value ?? "—"}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs font-medium tabular-nums text-fg">{value}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   5) CITATION EXPLORER  (answer ↔ source linking — the showcase)
   ════════════════════════════════════════════════════════════════ */
export function CitationExplorer({ trace }: { trace: RagTraceDetail }) {
  const segments = splitAnswerByCitations(trace.answer);
  const citations = trace.citations;
  const [active, setActive] = useState<number | null>(null);

  const citedRanks = new Set(citations.map((c) => c.rank));

  return (
    <Section
      id="citations"
      num={5}
      icon="link"
      title="Citation Explorer"
      subtitle="Which retrieved chunks became citations, and where"
      actions={
        <ToneBadge
          tone="neutral"
          label={`${fmtNumber(citations.length)} ${citations.length === 1 ? "citation" : "citations"}`}
          icon="link"
        />
      }
    >
      {citations.length === 0 ? (
        <Panel>
          <div className="flex min-w-0 flex-col items-center gap-2 py-6 text-center">
            <Icon name="link" size={20} className="text-fg-subtle" aria-hidden="true" />
            <p className="text-sm font-medium text-fg">No citations were recorded for this answer.</p>
          </div>
        </Panel>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_minmax(0,360px)]">
          {/* LEFT — answer */}
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Grounded answer</p>
              <CopyButton text={trace.answer} label="Copy answer" size="xs" />
            </div>
            <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
              {trace.answer.trim() === "" ? (
                <span className="italic text-fg-subtle">—</span>
              ) : (
                segments.map((seg, i) =>
                  seg.type === "text" ? (
                    <span key={i}>{seg.text}</span>
                  ) : (
                    <CiteChip
                      key={i}
                      num={seg.num}
                      hasMatch={citedRanks.has(seg.num)}
                      active={active === seg.num}
                      onActivate={() => setActive(seg.num)}
                      onClear={() => setActive(null)}
                    />
                  ),
                )
              )}
            </div>
          </div>

          {/* RIGHT — citation cards */}
          <div className="flex min-w-0 flex-col gap-2.5">
            {citations.map((c) => (
              <CitationSourceCard
                key={`${c.rank}-${c.chunk_id}`}
                citation={c}
                active={active === c.rank}
                onToggle={() => setActive((prev) => (prev === c.rank ? null : c.rank))}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function CiteChip({
  num,
  hasMatch,
  active,
  onActivate,
  onClear,
}: {
  num: number;
  hasMatch: boolean;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
}) {
  const base =
    "mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded px-1 align-baseline text-[11px] font-bold tabular-nums transition outline-none focus-visible:ring-2 focus-visible:ring-focus";
  const tone = !hasMatch
    ? "border border-line bg-sunken text-fg-subtle"
    : active
      ? "border border-brand bg-brand text-brand-fg ring-2 ring-focus"
      : "border border-brand-subtle-line bg-brand-subtle text-brand-fg hover:bg-brand-subtle/70";

  return (
    <button
      type="button"
      className={`${base} ${tone}`}
      aria-label={
        hasMatch ? `Highlight citation ${num}` : `Citation marker ${num} (no matching source recorded)`
      }
      title={hasMatch ? `Citation [${num}]` : `Citation [${num}] — no matching source recorded`}
      aria-pressed={active}
      disabled={!hasMatch}
      onMouseEnter={hasMatch ? onActivate : undefined}
      onMouseLeave={hasMatch ? onClear : undefined}
      onFocus={hasMatch ? onActivate : undefined}
      onBlur={hasMatch ? onClear : undefined}
      onClick={hasMatch ? onActivate : undefined}
    >
      [{num}]
    </button>
  );
}

function CitationSourceCard({
  citation,
  active,
  onToggle,
}: {
  citation: RagTraceCitation;
  active: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [active]);

  const preview = safePreview(citation.content ?? citation.content_preview, 200);
  const hasFull = !!citation.content;

  return (
    <div
      ref={ref}
      className={`min-w-0 rounded-lg border bg-surface shadow-sm transition ${
        active ? "border-brand ring-2 ring-focus" : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={`${active ? "Unhighlight" : "Highlight"} citation ${citation.rank} from ${citation.filename}`}
        className="flex w-full min-w-0 items-start gap-2 rounded-t-lg p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span
          className={`grid h-6 w-7 shrink-0 place-items-center rounded-md text-[11px] font-bold tabular-nums ${
            active ? "bg-brand text-brand-fg" : "bg-brand-subtle text-brand-fg"
          }`}
        >
          [{citation.rank}]
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name={fileIcon(citation.filename)} size={13} className="shrink-0 text-fg-subtle" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm font-medium text-fg" title={citation.filename}>
              {citation.filename}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-subtle">
            chunk {citation.chunk_index} · score{" "}
            <span className="font-mono tabular-nums text-fg-muted">{citation.score.toFixed(2)}</span>
          </p>
        </div>
      </button>

      <div className="px-3 pb-3">
        <p className="min-w-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted">
          {preview}
        </p>
        {hasFull ? (
          <details className="group mt-2 min-w-0">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-[11px] font-medium text-brand-fg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
              <Icon
                name="chevronRight"
                size={12}
                className="transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              Show full source
            </summary>
            <div className="mt-2 max-h-72 min-w-0 overflow-y-auto rounded-md border border-line-subtle bg-sunken p-2">
              <p className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-fg">
                {citation.content}
              </p>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
