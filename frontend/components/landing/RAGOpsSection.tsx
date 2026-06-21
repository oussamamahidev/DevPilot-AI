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

const workspaces = [
  { name: "Engineering Docs", score: 94, color: "bg-[#10b981]" },
  { name: "Product Specs",    score: 87, color: "bg-[#10b981]" },
  { name: "Security Policies",score: 61, color: "bg-[#f59e0b]" },
  { name: "Legacy Codebase",  score: 38, color: "bg-[#ef4444]" },
];

const bars = [
  { label: "Mon", height: 60,  opacity: "opacity-60" },
  { label: "Tue", height: 75,  opacity: "opacity-75" },
  { label: "Wed", height: 45,  opacity: "opacity-50" },
  { label: "Thu", height: 88,  opacity: "opacity-90" },
];

const bullets = [
  {
    icon: "activity" as const,
    title: "Real-time Metrics",
    body: "Monitor faithfulness, relevance, and hallucination trends as they evolve.",
  },
  {
    icon: "trendingUp" as const,
    title: "Workspace Drilldown",
    body: "Drill into any workspace to inspect document coverage, chunk quality, and vector sync.",
  },
  {
    icon: "shield" as const,
    title: "Failure Alerts",
    body: "Detect failing documents, retrieval gaps, and quality degradation before users notice.",
  },
];

export default function RAGOpsSection() {
  const { ref, inView } = useInView(0.08);

  return (
    <section className="relative py-20 sm:py-28 bg-[#0a0b0e]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,77,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(124,77,255,0.03) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div
          ref={ref}
          className={`text-center mb-12 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            RAGOps
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee] mb-4">
            Observability for
            <br />
            your AI pipeline
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] max-w-2xl mx-auto">
            Monitor answer quality, retrieval performance, and platform health in real time.
            Inspired by Grafana and Datadog, built specifically for RAG systems.
          </p>
        </div>

        {/* Dashboard mock */}
        <div
          className={`transition-all duration-700 delay-200 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="rounded-2xl border border-[#272b33] bg-[#0a0b0e] overflow-hidden shadow-2xl">
            {/* Window chrome */}
            <div className="bg-[#111317] border-b border-[#272b33] px-4 py-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <span className="w-3 h-3 rounded-full bg-[#10b981]" />
              <span className="ml-3 text-sm text-[#a0a6b0] font-medium">
                RAGOps Control Tower · DevPilot AI
              </span>
            </div>

            {/* Dashboard content */}
            <div className="p-4 grid gap-4">
              {/* ROW 1: 4 metric tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* RAG Health */}
                <div className="rounded-xl border border-[#272b33] bg-[#111317] p-3">
                  <div className="text-xs text-[#6b7280] mb-1 font-medium">RAG Health</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[#10b981]">87</span>
                    <span className="text-sm text-[#6b7280]">/ 100</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#272b33]">
                    <div className="h-full rounded-full bg-[#10b981]" style={{ width: "87%" }} />
                  </div>
                </div>

                {/* Faithfulness */}
                <div className="rounded-xl border border-[#272b33] bg-[#111317] p-3">
                  <div className="text-xs text-[#6b7280] mb-1 font-medium">Faithfulness</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-[#ecedee]">0.84</span>
                    <span className="text-xs font-semibold text-[#10b981] flex items-center gap-0.5">
                      ▲ 0.03
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[#6b7280]">vs last 7 days</div>
                </div>

                {/* Hallucination Risk */}
                <div className="rounded-xl border border-[#272b33] bg-[#111317] p-3">
                  <div className="text-xs text-[#6b7280] mb-1 font-medium">Hallucination Risk</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-[#ecedee]">0.12</span>
                    <span className="text-xs font-semibold text-[#10b981] flex items-center gap-0.5">
                      ▼ 0.04
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[#10b981]">lower is better</div>
                </div>

                {/* Active Workspaces */}
                <div className="rounded-xl border border-[#272b33] bg-[#111317] p-3">
                  <div className="text-xs text-[#6b7280] mb-1 font-medium">Active Workspaces</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[#ecedee]">12</span>
                  </div>
                  <div className="mt-2 text-xs text-[#6b7280]">3 syncing now</div>
                </div>
              </div>

              {/* ROW 2: workspace health + retrieval chart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Workspace Health */}
                <div className="rounded-xl border border-[#272b33] bg-[#111317] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-4">
                    Workspace Health
                  </div>
                  <div className="space-y-3">
                    {workspaces.map(({ name, score, color }) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="text-sm text-[#ecedee] w-36 shrink-0 truncate">{name}</div>
                        <div className="flex-1 h-1.5 rounded-full bg-[#272b33]">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <div className="text-xs text-[#a0a6b0] w-10 text-right shrink-0">
                          {score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Retrieval Metrics bar chart */}
                <div className="rounded-xl border border-[#272b33] bg-[#111317] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-4">
                    Retrieval Metrics
                  </div>
                  <div className="flex gap-2 items-end h-28">
                    {/* Y-axis labels */}
                    <div className="flex flex-col justify-between h-full pr-1 text-right">
                      {["100", "75", "50", "25"].map((v) => (
                        <span key={v} className="text-[10px] text-[#6b7280] leading-none">
                          {v}
                        </span>
                      ))}
                    </div>

                    {/* Bars */}
                    <div className="flex flex-1 items-end gap-2 h-full">
                      {bars.map(({ label, height, opacity }) => (
                        <div
                          key={label}
                          className="flex flex-col items-center gap-1.5 flex-1"
                        >
                          <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                            <div
                              className={`w-full rounded-t bg-[#7c4dff] ${opacity} transition-all duration-700`}
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#6b7280]">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature bullets */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 transition-all duration-700 delay-300 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {bullets.map(({ icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-[#272b33] bg-[#111317] p-6 hover:border-[#7c4dff]/40 hover:shadow-[0_0_20px_rgba(124,77,255,0.08)] transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#7c4dff]/10 flex items-center justify-center mb-4">
                <Icon name={icon} size={20} className="text-[#7c4dff]" />
              </div>
              <h3 className="text-xl font-semibold text-[#ecedee] mb-2">{title}</h3>
              <p className="text-base leading-relaxed text-[#a0a6b0]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
