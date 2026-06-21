import type { ReactNode } from "react";
import type { Citation } from "@/types";

/**
 * Lightweight, dependency-free markdown renderer for streamed assistant answers.
 * Supports: headings, bold, italic, inline code, fenced code blocks, ordered/
 * unordered lists, horizontal rules, and inline [n] citation markers that link
 * to the answer's source documents.
 */

/* ─── inline citation marker ─────────────────────────────────── */
export function CitationMarker({ num, filename }: { num: number; filename?: string }) {
  return (
    <span
      title={filename ? `Source ${num}: ${filename}` : `Citation ${num}`}
      className="mx-0.5 inline-flex h-[18px] w-[18px] -translate-y-px cursor-default items-center justify-center rounded-full border border-brand-subtle-line bg-brand-subtle align-middle text-[10px] font-bold leading-none text-brand-fg"
    >
      {num}
    </span>
  );
}

/* ─── inline parser (bold / italic / code / citations) ───────── */
function parseInline(text: string, citations: Citation[], prefix: string): ReactNode {
  if (!text) return text;
  const re = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|`[^`]+`|\[\d+\])/g;
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(<span key={`${prefix}-t${k++}`}>{text.slice(lastIdx, m.index)}</span>);
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${prefix}-b${k++}`} className="font-semibold text-fg">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={`${prefix}-i${k++}`} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={`${prefix}-c${k++}`} className="mx-0.5 rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.8em] text-brand-fg">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const num = parseInt(token.slice(1, -1), 10);
      const cit = citations.find(c => c.id === num);
      parts.push(<CitationMarker key={`${prefix}-m${k++}`} num={num} filename={cit?.filename} />);
    }
    lastIdx = m.index + m.length;
  }
  if (lastIdx < text.length) parts.push(<span key={`${prefix}-e${k}`}>{text.slice(lastIdx)}</span>);
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/* ─── block renderer ─────────────────────────────────────────── */
export function ChatMarkdown({ content, citations = [] }: { content: string; citations?: Citation[] }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let codeLines: string[] = [];
  let inCode = false;
  let listItems: ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (listItems.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    const cls = listType === "ol" ? "my-2 grid list-decimal gap-1 pl-5" : "my-2 grid list-disc gap-1 pl-5";
    blocks.push(<Tag key={`list-${blocks.length}`} className={cls}>{listItems}</Tag>);
    listItems = [];
    listType = null;
  }

  lines.forEach((line, i) => {
    const k = `line-${i}`;

    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(
          <pre key={k} className="my-3 overflow-x-auto rounded-lg border border-line bg-sunken p-4">
            <code className="font-mono text-xs leading-6 text-fg">{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      return;
    }
    if (inCode) { codeLines.push(line); return; }

    const ulM = line.match(/^[-*]\s+(.+)/);
    const olM = line.match(/^\d+\.\s+(.+)/);
    if (ulM) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(<li key={k} className="text-sm leading-7 text-fg">{parseInline(ulM[1], citations, k)}</li>);
      return;
    }
    if (olM) {
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listItems.push(<li key={k} className="text-sm leading-7 text-fg">{parseInline(olM[1], citations, k)}</li>);
      return;
    }
    flushList();

    if (line.startsWith("### ")) { blocks.push(<h3 key={k} className="mb-1 mt-4 text-sm font-semibold text-fg">{parseInline(line.slice(4), citations, k)}</h3>); return; }
    if (line.startsWith("## ")) { blocks.push(<h2 key={k} className="mb-1 mt-5 text-base font-semibold text-fg">{parseInline(line.slice(3), citations, k)}</h2>); return; }
    if (line.startsWith("# ")) { blocks.push(<h1 key={k} className="mb-2 mt-5 text-lg font-semibold text-fg">{parseInline(line.slice(2), citations, k)}</h1>); return; }
    if (line.match(/^---+$/)) { blocks.push(<hr key={k} className="my-4 border-line" />); return; }
    if (!line.trim()) { if (blocks.length > 0) blocks.push(<div key={k} className="h-2" />); return; }

    blocks.push(<p key={k} className="text-sm leading-7 text-fg">{parseInline(line, citations, k)}</p>);
  });

  flushList();
  if (inCode && codeLines.length > 0) {
    blocks.push(
      <pre key="trailing-code" className="my-3 overflow-x-auto rounded-lg border border-line bg-sunken p-4">
        <code className="font-mono text-xs leading-6 text-fg">{codeLines.join("\n")}</code>
      </pre>
    );
  }

  return <div className="min-w-0 space-y-0.5">{blocks}</div>;
}

/* ─── typing indicator ───────────────────────────────────────── */
export function TypingDots({ label = "Generating answer" }: { label?: string }) {
  return (
    <div className="flex items-center gap-1 py-1" role="status" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-fg-subtle motion-safe:animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}
