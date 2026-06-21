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

function TierBox({
  icon,
  iconColor,
  title,
  subtitle,
  delay = 0,
  inView,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  iconColor: string;
  title: string;
  subtitle: string;
  delay?: number;
  inView: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-[#7c4dff]/40 bg-[#111317] px-8 py-4 inline-flex items-center gap-3 transition-all hover:border-[#7c4dff]/60 hover:shadow-[0_0_20px_rgba(124,77,255,0.1)] cursor-default"
      style={{
        transitionDelay: `${delay}ms`,
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms, border-color 0.2s, box-shadow 0.2s`,
      }}
    >
      <Icon name={icon} size={22} className={iconColor} />
      <div>
        <div className="text-sm font-semibold text-[#ecedee]">{title}</div>
        <div className="text-xs text-[#6b7280] mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

function Connector({ delay = 0, inView }: { delay?: number; inView: boolean }) {
  return (
    <div
      className="flex justify-center"
      style={{
        opacity: inView ? 1 : 0,
        transition: `opacity 0.5s ease ${delay}ms`,
      }}
    >
      <div className="relative h-12 w-px">
        <div className="absolute inset-0 w-px bg-gradient-to-b from-[#7c4dff] to-[#272b33]" />
        <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#7c4dff] animate-bounce" style={{ top: "20%" }} />
      </div>
    </div>
  );
}

export default function ArchitectureSection() {
  const { ref, inView } = useInView(0.08);

  return (
    <section id="architecture" className="relative py-20 sm:py-28 bg-[#0a0b0e]">
      {/* Subtle grid background */}
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
          className={`text-center mb-14 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            System Architecture
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee] mb-4">
            Built on proven
            <br />
            open-source infrastructure
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] max-w-2xl mx-auto">
            A modern async stack: Next.js frontend, FastAPI backend, Celery workers, PostgreSQL for
            metadata, Redis for caching, and Qdrant for vector storage.
          </p>
        </div>

        {/* Architecture diagram */}
        <div className="flex flex-col items-center">

          {/* TIER 1 — Client */}
          <div
            className="text-center mb-1"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 100ms, transform 0.5s ease 100ms",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] block mb-3">
              Client
            </span>
          </div>
          <div className="flex justify-center">
            <TierBox
              icon="monitor"
              iconColor="text-[#7c4dff]"
              title="Next.js 15"
              subtitle="React 19 · TypeScript · Tailwind"
              delay={150}
              inView={inView}
            />
          </div>

          <Connector delay={250} inView={inView} />

          {/* TIER 2 — API Layer */}
          <div
            className="text-center mb-1"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 300ms, transform 0.5s ease 300ms",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] block mb-3">
              API Layer
            </span>
          </div>
          <div className="flex justify-center">
            <TierBox
              icon="server"
              iconColor="text-[#10b981]"
              title="FastAPI"
              subtitle="Python · Async · OpenAPI"
              delay={350}
              inView={inView}
            />
          </div>

          <Connector delay={450} inView={inView} />

          {/* TIER 3 — Services */}
          <div
            className="text-center mb-1"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 500ms, transform 0.5s ease 500ms",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] block mb-3">
              Services
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 justify-items-center w-full max-w-3xl">
            <div className="flex justify-center">
              <TierBox
                icon="activity"
                iconColor="text-[#f59e0b]"
                title="Celery Workers"
                subtitle="Async document processing"
                delay={550}
                inView={inView}
              />
            </div>
            <div className="flex justify-center">
              <TierBox
                icon="database"
                iconColor="text-[#3b82f6]"
                title="PostgreSQL"
                subtitle="Metadata · Audit · Users"
                delay={620}
                inView={inView}
              />
            </div>
            <div className="flex justify-center">
              <TierBox
                icon="box"
                iconColor="text-[#a0a6b0]"
                title="Redis"
                subtitle="Cache · Queue · Session"
                delay={690}
                inView={inView}
              />
            </div>
          </div>

          <Connector delay={750} inView={inView} />

          {/* TIER 4 — Vector Store */}
          <div
            className="text-center mb-1"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 800ms, transform 0.5s ease 800ms",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] block mb-3">
              Vector Store
            </span>
          </div>
          <div className="flex justify-center">
            <TierBox
              icon="sparkles"
              iconColor="text-[#7c4dff]"
              title="Qdrant"
              subtitle="Vector DB · HNSW · Sub-ms search"
              delay={850}
              inView={inView}
            />
          </div>

          <Connector delay={950} inView={inView} />

          {/* TIER 5 — AI Models */}
          <div
            className="text-center mb-1"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 1000ms, transform 0.5s ease 1000ms",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] block mb-3">
              AI Models
            </span>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <TierBox
              icon="cpu"
              iconColor="text-[#f59e0b]"
              title="Gemini 2.5 Flash"
              subtitle="Generation · Evaluation"
              delay={1050}
              inView={inView}
            />
            <TierBox
              icon="server"
              iconColor="text-[#10b981]"
              title="Ollama"
              subtitle="Local embedding · Privacy"
              delay={1120}
              inView={inView}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
