"use client";

import { useEffect, useRef, useState } from "react";

// ─── Scroll-reveal hook ────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );
    const el = ref.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const problems = [
  {
    title: "Knowledge is Scattered",
    description:
      "Docs in Notion, Confluence, GitHub, Slack. Engineers waste hours hunting for answers.",
  },
  {
    title: "Search Doesn't Understand Intent",
    description:
      "Keyword search fails with technical questions. You can't query your documentation the way you think.",
  },
  {
    title: "AI Hallucinations",
    description:
      "Generic AI tools fabricate answers confidently. There's no way to verify what's true and what's invented.",
  },
  {
    title: "Zero Traceability",
    description:
      "When an AI answer is wrong, you have no idea which documents were used or why.",
  },
  {
    title: "No Observability",
    description:
      "You can't measure answer quality, retrieval accuracy, or model performance over time.",
  },
];

const solutions = [
  {
    title: "Unified Knowledge Base",
    description:
      "Upload PDFs, docs, and text. DevPilot chunks, embeds, and indexes everything into searchable vector storage.",
  },
  {
    title: "Semantic + Hybrid Search",
    description:
      "Ask in natural language. Hybrid retrieval finds semantically relevant chunks, then reranks for precision.",
  },
  {
    title: "Grounded Answers with Citations",
    description:
      "Every answer cites its source documents. If the answer isn't in your docs, DevPilot says so.",
  },
  {
    title: "Full Trace Explorer",
    description:
      "Inspect every query: which chunks were retrieved, how they were ranked, what the model generated, and how it scored.",
  },
  {
    title: "RAGOps Dashboard",
    description:
      "Monitor faithfulness, relevance, hallucination risk, and retrieval metrics across all workspaces in real time.",
  },
];

// ─── Card components ───────────────────────────────────────────────────────────
interface CardProps {
  title: string;
  description: string;
  index: number;
  variant: "problem" | "solution";
  inView: boolean;
}

function ItemCard({ title, description, index, variant, inView }: CardProps) {
  const isProblem = variant === "problem";

  return (
    <div
      className={`
        transition-all duration-700
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        rounded-xl border p-5 flex gap-4 items-start
        ${
          isProblem
            ? "border-[#ef4444]/20 bg-[#111317] hover:border-[#ef4444]/30"
            : "border-[#10b981]/20 bg-[#111317] hover:border-[#10b981]/30"
        }
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Icon circle */}
      <span
        className={`
          w-8 h-8 rounded-full flex items-center justify-center shrink-0
          text-sm font-bold mt-0.5
          ${
            isProblem
              ? "bg-[#ef4444]/10 text-[#ef4444]"
              : "bg-[#10b981]/10 text-[#10b981]"
          }
        `}
        aria-hidden="true"
      >
        {isProblem ? "✕" : "✓"}
      </span>

      {/* Text */}
      <div>
        <h3 className="text-base font-semibold text-[#ecedee] mb-1 leading-snug">{title}</h3>
        <p className="text-sm leading-relaxed text-[#a0a6b0]">{description}</p>
      </div>
    </div>
  );
}

// ─── Column wrapper with its own scroll reveal ────────────────────────────────
interface ColumnProps {
  variant: "problem" | "solution";
  items: { title: string; description: string }[];
}

function Column({ variant, items }: ColumnProps) {
  const { ref, inView } = useInView(0.08);
  const isProblem = variant === "problem";

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {/* Column header */}
      <div
        className={`
          transition-all duration-500
          ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          rounded-xl border p-4 flex items-center gap-3
          ${
            isProblem
              ? "border-[#ef4444]/25 bg-[#ef4444]/5"
              : "border-[#10b981]/25 bg-[#10b981]/5"
          }
        `}
      >
        <span
          className={`
            w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base font-bold
            ${isProblem ? "bg-[#ef4444]/15 text-[#ef4444]" : "bg-[#10b981]/15 text-[#10b981]"}
          `}
          aria-hidden="true"
        >
          {isProblem ? "✕" : "✓"}
        </span>
        <span
          className={`text-sm font-semibold tracking-wide ${
            isProblem ? "text-[#ef4444]" : "text-[#10b981]"
          }`}
        >
          {isProblem ? "Before DevPilot AI" : "With DevPilot AI"}
        </span>
      </div>

      {/* Cards */}
      {items.map((item, i) => (
        <ItemCard
          key={item.title}
          title={item.title}
          description={item.description}
          index={i + 1}
          variant={variant}
          inView={inView}
        />
      ))}
    </div>
  );
}

// ─── Heading reveal ────────────────────────────────────────────────────────────
function HeadingBlock() {
  const { ref, inView } = useInView(0.15);

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-700
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        text-center mb-16
      `}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
        The Problem
      </p>
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee] leading-snug mb-5">
        Your knowledge is scattered.
        <br />
        Your AI isn&apos;t reliable.
      </h2>
      <p className="max-w-2xl mx-auto text-base leading-relaxed text-[#a0a6b0]">
        Engineering teams struggle with knowledge fragmentation, unreliable AI answers, and zero
        visibility into how those answers are generated.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ProblemSection() {
  return (
    <section
      id="features"
      className="relative py-20 sm:py-28 bg-[#0a0b0e] overflow-hidden"
    >
      {/* Subtle section separator glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg,transparent,rgba(124,77,255,0.3),transparent)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <HeadingBlock />

        {/* Two-column grid */}
        <div className="grid gap-8 md:grid-cols-2 items-start">
          <Column variant="problem" items={problems} />
          <Column variant="solution" items={solutions} />
        </div>
      </div>

      {/* Bottom separator */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg,transparent,rgba(124,77,255,0.15),transparent)",
        }}
        aria-hidden="true"
      />
    </section>
  );
}
