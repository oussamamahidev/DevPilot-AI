"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

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

interface Step {
  icon: IconName;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: "cloudUpload",
    title: "Document Upload",
    description:
      "Upload PDFs, Markdown, and text files. The backend validates format, size, and queues for processing.",
  },
  {
    icon: "fileText",
    title: "Text Extraction",
    description:
      "Apache Tika and custom parsers extract clean text from every document format while preserving structure.",
  },
  {
    icon: "layers",
    title: "Smart Chunking",
    description:
      "Documents are split into overlapping semantic chunks optimized for retrieval — not too large, not too small.",
  },
  {
    icon: "sparkles",
    title: "Vector Embedding",
    description:
      "Each chunk is embedded using Ollama or Gemini embedding models into high-dimensional semantic vectors.",
  },
  {
    icon: "database",
    title: "Qdrant Indexing",
    description:
      "Vectors are stored in Qdrant with metadata. The HNSW index enables sub-millisecond approximate nearest neighbor search.",
  },
  {
    icon: "search",
    title: "Hybrid Retrieval",
    description:
      "Queries trigger both semantic (cosine similarity) and keyword (BM25) retrieval. Results are merged and deduplicated.",
  },
  {
    icon: "activity",
    title: "Reranking",
    description:
      "A cross-encoder reranker scores all retrieved candidates and selects the top-K most relevant chunks.",
  },
  {
    icon: "message",
    title: "LLM Generation",
    description:
      "The reranked context is injected into the prompt. Gemini or Ollama generates a grounded, contextual answer.",
  },
  {
    icon: "link",
    title: "Citations",
    description:
      "Every claim in the answer is linked to its source chunk. Users can inspect exactly which document supported each statement.",
  },
  {
    icon: "shield",
    title: "Evaluation",
    description:
      "Faithfulness, relevance, and hallucination scores are computed per answer and stored for trend analysis in RAGOps.",
  },
];

function StepCard({
  step,
  index,
}: {
  step: Step;
  index: number;
}) {
  const isLeft = index % 2 === 0;
  const { ref, inView } = useInView(0.1);

  return (
    <div className="relative flex items-center justify-center w-full mb-10 last:mb-0">
      {/* Mobile: single column */}
      <div className="flex w-full items-center gap-4 md:hidden">
        {/* Step number node */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#7c4dff] flex items-center justify-center text-sm font-bold text-white z-10 relative shadow-lg shadow-[#7c4dff]/20">
          {index + 1}
        </div>
        <div
          ref={ref}
          className={`flex-1 rounded-xl border border-[#272b33] bg-[#111317] p-5 transition-all duration-700 ${
            inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#7c4dff]/10 flex items-center justify-center text-[#7c4dff]">
              <Icon name={step.icon} size={16} />
            </div>
            <h3 className="text-base font-semibold text-[#ecedee]">
              {step.title}
            </h3>
          </div>
          <p className="text-sm text-[#a0a6b0] leading-relaxed">
            {step.description}
          </p>
        </div>
      </div>

      {/* Desktop: alternating layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_80px_1fr] w-full items-center gap-0">
        {/* Left slot */}
        <div className="flex justify-end pr-6">
          {isLeft ? (
            <div
              ref={ref}
              className={`max-w-sm w-full rounded-xl border border-[#272b33] bg-[#111317] p-5 transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-10"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#7c4dff]/10 flex items-center justify-center text-[#7c4dff]">
                  <Icon name={step.icon} size={18} />
                </div>
                <h3 className="text-base font-semibold text-[#ecedee]">
                  {step.title}
                </h3>
              </div>
              <p className="text-sm text-[#a0a6b0] leading-relaxed">
                {step.description}
              </p>
            </div>
          ) : (
            <div />
          )}
        </div>

        {/* Center node */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-[#7c4dff] flex items-center justify-center text-sm font-bold text-white z-10 relative shadow-lg shadow-[#7c4dff]/25">
            {index + 1}
          </div>
        </div>

        {/* Right slot */}
        <div className="flex justify-start pl-6">
          {!isLeft ? (
            <div
              ref={ref}
              className={`max-w-sm w-full rounded-xl border border-[#272b33] bg-[#111317] p-5 transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-10"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#7c4dff]/10 flex items-center justify-center text-[#7c4dff]">
                  <Icon name={step.icon} size={18} />
                </div>
                <h3 className="text-base font-semibold text-[#ecedee]">
                  {step.title}
                </h3>
              </div>
              <p className="text-sm text-[#a0a6b0] leading-relaxed">
                {step.description}
              </p>
            </div>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const { ref: headingRef, inView: headingInView } = useInView(0.1);

  return (
    <section
      id="how-it-works"
      className="relative py-20 sm:py-28 bg-[#0a0b0e] overflow-hidden"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,77,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,77,255,0.04) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        {/* Heading */}
        <div
          ref={headingRef}
          className={`text-center mb-16 transition-all duration-700 ${
            headingInView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee] mb-4">
            From raw document to{" "}
            <span className="bg-gradient-to-r from-[#9470ff] via-[#b098ff] to-[#9470ff] bg-clip-text text-transparent">
              grounded AI answer
            </span>
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] max-w-2xl mx-auto">
            DevPilot&apos;s full RAG pipeline — from file upload to evaluatable, citable
            responses — is completely transparent and observable.
          </p>
        </div>

        {/* Pipeline timeline */}
        <div className="relative">
          {/* Vertical center line — desktop only */}
          <div
            className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, #7c4dff 0%, #7c4dff 40%, #272b33 70%, transparent 100%)",
            }}
          />

          {/* Steps */}
          {steps.map((step, index) => (
            <StepCard key={step.title} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
