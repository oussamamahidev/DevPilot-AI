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

interface Feature {
  icon: IconName;
  title: string;
  description: string;
  tag: string;
}

const features: Feature[] = [
  {
    icon: "grid",
    title: "Workspace Management",
    description:
      "Isolated multi-tenant workspaces. Each team's documents, conversations, and settings are completely separate.",
    tag: "Multi-tenant",
  },
  {
    icon: "fileText",
    title: "Document Intelligence",
    description:
      "Support for PDF, Markdown, TXT. Smart extraction, chunking, and metadata indexing with status tracking.",
    tag: "Ingestion",
  },
  {
    icon: "search",
    title: "Semantic Search",
    description:
      "Ask questions in natural language. Cosine similarity over dense embeddings surfaces the most relevant passages.",
    tag: "Retrieval",
  },
  {
    icon: "layers",
    title: "Hybrid Retrieval",
    description:
      "Combine dense vector search with BM25 sparse retrieval. Merge strategies reduce noise and improve recall.",
    tag: "RAG",
  },
  {
    icon: "activity",
    title: "Reranking",
    description:
      "Cross-encoder models rescore retrieval candidates. Only the most relevant chunks reach the language model.",
    tag: "Precision",
  },
  {
    icon: "message",
    title: "Streaming Chat",
    description:
      "Real-time streaming responses with Server-Sent Events. See the answer form word-by-word with live citations.",
    tag: "UX",
  },
  {
    icon: "shield",
    title: "Answer Evaluation",
    description:
      "Faithfulness, relevance, and hallucination scoring per answer. Stored, trended, and surfaced in RAGOps.",
    tag: "Evaluation",
  },
  {
    icon: "trendingUp",
    title: "RAGOps Dashboard",
    description:
      "Grafana-inspired observability for your RAG pipeline. Health scores, retrieval metrics, and failure alerts.",
    tag: "Observability",
  },
  {
    icon: "eye",
    title: "Trace Explorer",
    description:
      "LangSmith-style query tracing. Inspect retrieved chunks, reranking scores, generation, and evaluation for every query.",
    tag: "Debugging",
  },
  {
    icon: "cpu",
    title: "Admin Dashboard",
    description:
      "User management, workspace admin, audit logs, and platform KPIs — all in a single operational console.",
    tag: "Admin",
  },
];

function FeatureCard({ feature, delay }: { feature: Feature; delay: number }) {
  return (
    <div
      className="rounded-xl border border-[#272b33] bg-[#111317] p-6 group hover:border-[#7c4dff]/50 transition-colors duration-300 flex flex-col"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-[#7c4dff]/10 flex items-center justify-center text-[#7c4dff] group-hover:bg-[#7c4dff]/20 transition-colors">
        <Icon name={feature.icon} size={18} />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-[#ecedee] mt-4">
        {feature.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[#a0a6b0] mt-2 leading-relaxed flex-1">
        {feature.description}
      </p>

      {/* Tag */}
      <div className="flex justify-end mt-4">
        <span className="text-xs text-[#6b7280] border border-[#272b33] rounded-full px-2 py-0.5 group-hover:border-[#7c4dff]/30 group-hover:text-[#9470ff] transition-colors duration-300">
          {feature.tag}
        </span>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const { ref: headingRef, inView: headingInView } = useInView(0.1);
  const { ref: gridRef, inView: gridInView } = useInView(0.05);

  return (
    <section
      id="features"
      className="relative py-20 sm:py-28 bg-[#0a0b0e] overflow-hidden"
    >
      {/* Radial glow */}
      <div
        className="absolute inset-x-0 top-0 h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%,rgba(124,77,255,0.25),transparent)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        {/* Heading */}
        <div
          ref={headingRef}
          className={`text-center mb-14 transition-all duration-700 ${
            headingInView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            Platform Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee] mb-4">
            Everything you need to build{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#9470ff] via-[#b098ff] to-[#9470ff] bg-clip-text text-transparent">
              reliable AI systems
            </span>
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] max-w-2xl mx-auto">
            Ten core capabilities — workspace management, semantic search,
            observable retrieval, and enterprise-grade admin tools.
          </p>
        </div>

        {/* Features grid */}
        <div
          ref={gridRef}
          className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 transition-all duration-700 ${
            gridInView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              delay={index * 50}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
