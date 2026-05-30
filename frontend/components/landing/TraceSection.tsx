"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

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

export default function TraceSection() {
  const { ref, inView } = useInView();

  return (
    <section className="relative py-20 sm:py-28 bg-[#0a0b0e]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            Trace Explorer
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee]">
            See exactly how
            <br />
            every answer was built
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] mt-4 max-w-2xl mx-auto">
            LangSmith-inspired query tracing gives you complete visibility into the retrieval,
            reranking, generation, and evaluation for every single question.
          </p>
        </div>

        {/* Mock Trace Explorer UI */}
        <div
          ref={ref}
          className={`transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="rounded-2xl border border-[#272b33] bg-[#0a0b0e] overflow-hidden shadow-2xl max-w-4xl mx-auto">
            {/* Header Bar */}
            <div className="bg-[#111317] border-b border-[#272b33] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Traffic light dots */}
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <span className="w-3 h-3 rounded-full bg-[#10b981]" />
                </div>
                <span className="font-mono text-sm text-[#a0a6b0]">
                  Trace Explorer · msg_2a8f3bc1
                </span>
              </div>
              <span className="text-xs text-[#10b981] border border-[#10b981]/30 bg-[#10b981]/10 rounded-full px-2 py-0.5">
                Faithfulness 0.89
              </span>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Question Box */}
              <div className="mb-4 rounded-lg border border-[#272b33] bg-[#111317] px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">Question</p>
                <p className="text-sm text-[#ecedee]">
                  How does our distributed caching strategy handle cache invalidation across regions?
                </p>
              </div>

              {/* Pipeline Steps */}
              <div className="grid gap-2">
                {/* Step 1 — Retrieval */}
                <div className="rounded-lg border border-[#272b33] bg-[#111317] p-3 border-l-2 border-l-[#3b82f6]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                      <Icon name="search" size={14} />
                    </div>
                    <span className="text-sm font-semibold text-[#ecedee]">Retrieval</span>
                    <span className="ml-auto text-xs text-[#6b7280]">7 chunks · 124ms</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {[
                      "[1] caching-architecture.md · score 0.94",
                      "[2] distributed-systems.md · score 0.87",
                      "[3] redis-configuration.md · score 0.81",
                    ].map((chunk) => (
                      <div
                        key={chunk}
                        className="rounded bg-[#181b20] border border-[#272b33] px-2 py-1 text-xs text-[#a0a6b0]"
                      >
                        {chunk}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2 — Reranking */}
                <div className="rounded-lg border border-[#272b33] bg-[#111317] p-3 border-l-2 border-l-[#f59e0b]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">
                      <Icon name="activity" size={14} />
                    </div>
                    <span className="text-sm font-semibold text-[#ecedee]">Reranking</span>
                    <span className="ml-auto text-xs text-[#6b7280]">3 of 7 selected · 89ms</span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-[#6b7280]">
                      Cross-encoder selected chunks [1][3][2] · Removed 4 low-relevance results
                    </p>
                  </div>
                </div>

                {/* Step 3 — Generation */}
                <div className="rounded-lg border border-[#272b33] bg-[#111317] p-3 border-l-2 border-l-[#7c4dff]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#7c4dff]/10 flex items-center justify-center text-[#7c4dff]">
                      <Icon name="message" size={14} />
                    </div>
                    <span className="text-sm font-semibold text-[#ecedee]">Generation</span>
                    <span className="ml-auto text-xs text-[#6b7280]">247 tokens · 1.2s</span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-[#a0a6b0] italic">
                      Based on [1][3], the distributed caching strategy uses a write-invalidate
                      pattern...
                    </p>
                  </div>
                </div>

                {/* Step 4 — Evaluation */}
                <div className="rounded-lg border border-[#272b33] bg-[#111317] p-3 border-l-2 border-l-[#10b981]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
                      <Icon name="shield" size={14} />
                    </div>
                    <span className="text-sm font-semibold text-[#ecedee]">Evaluation</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                      Faithfulness 0.89
                    </span>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                      Relevance 0.91
                    </span>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                      Hallucination 0.08
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 feature bullets below mock UI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 max-w-4xl mx-auto">
            {[
              {
                icon: "eye" as const,
                title: "Complete Visibility",
                desc: "Every query shows retrieved chunks, reranking decisions, generation, and evaluation scores.",
              },
              {
                icon: "link" as const,
                title: "Source Attribution",
                desc: "Citations link every claim to the exact document chunk that supported it.",
              },
              {
                icon: "trendingUp" as const,
                title: "Quality Trends",
                desc: "Track faithfulness and hallucination scores over time to detect model or data drift.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-[#272b33] bg-[#111317] p-6"
              >
                <div className="w-9 h-9 rounded-lg bg-[#181b20] flex items-center justify-center text-[#7c4dff] mb-3">
                  <Icon name={icon} size={18} />
                </div>
                <h3 className="text-xl font-semibold text-[#ecedee] mb-1">{title}</h3>
                <p className="text-base leading-relaxed text-[#a0a6b0]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
