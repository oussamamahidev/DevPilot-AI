"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger staggered entrance on mount
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className="relative min-h-screen bg-[#0a0b0e] flex items-center justify-center pt-16 overflow-hidden"
      aria-label="Hero"
    >
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,77,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(124,77,255,0.05) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
        aria-hidden="true"
      />

      {/* Radial violet glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%,rgba(124,77,255,0.25),transparent)",
        }}
        aria-hidden="true"
      />

      {/* Additional ambient glow rings */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5"
        style={{ background: "radial-gradient(circle, #7c4dff, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">

          {/* Badge / pill */}
          <div
            className={`transition-all duration-700 delay-[0ms] ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[#272b33] bg-[#111317] px-4 py-1.5 text-xs font-medium text-[#9470ff] shadow-lg shadow-black/20 mb-8">
              <Icon name="sparkles" size={14} />
              Introducing DevPilot AI&nbsp;&middot;&nbsp;RAG-Native Intelligence
            </span>
          </div>

          {/* H1 Headline */}
          <div
            className={`transition-all duration-700 delay-[100ms] ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-tight text-[#ecedee]">
              The AI Platform Built
              <br />
              <span className="bg-gradient-to-r from-[#9470ff] via-[#b098ff] to-[#7c4dff] bg-clip-text text-transparent">
                for Engineering Teams
              </span>
            </h1>
          </div>

          {/* Subheadline */}
          <div
            className={`transition-all duration-700 delay-[200ms] ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-[#a0a6b0] leading-relaxed mt-6">
              Upload your documents, ask questions in natural language, and get answers with
              citations you can verify. Built-in RAG observability, workspace isolation, and
              answer evaluation for teams who care about accuracy.
            </p>
          </div>

          {/* CTA Buttons */}
          <div
            className={`transition-all duration-700 delay-[300ms] ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="flex flex-wrap gap-4 justify-center mt-10">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-[#7c4dff] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9470ff] transition-colors shadow-lg shadow-[#7c4dff]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
              >
                Start Building
                <Icon name="arrowRight" size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-[#272b33] bg-[#111317] px-6 py-3 text-sm font-semibold text-[#ecedee] hover:bg-[#181b20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
              >
                See How It Works
                <Icon name="chevronDown" size={16} />
              </a>
            </div>
          </div>

          {/* Trust strip */}
          <div
            className={`transition-all duration-700 delay-[400ms] ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="mt-12 flex items-center justify-center gap-6 sm:gap-8 flex-wrap">
              <span className="flex items-center gap-2 text-sm text-[#6b7280]">
                <Icon name="shield" size={14} />
                Citations on every answer
              </span>
              <span className="text-[#272b33] hidden sm:block" aria-hidden="true">&middot;</span>
              <span className="flex items-center gap-2 text-sm text-[#6b7280]">
                <Icon name="activity" size={14} />
                Full RAG observability
              </span>
              <span className="text-[#272b33] hidden sm:block" aria-hidden="true">&middot;</span>
              <span className="flex items-center gap-2 text-sm text-[#6b7280]">
                <Icon name="layers" size={14} />
                Workspace isolation
              </span>
            </div>
          </div>

          {/* Mock UI Card Preview */}
          <div
            className={`transition-all duration-700 delay-[500ms] ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            } mt-20 w-full max-w-3xl mx-auto`}
          >
            {/* Glow beneath the card */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-2/3 h-8 blur-3xl rounded-full opacity-30 pointer-events-none"
              style={{ background: "linear-gradient(90deg,#7c4dff,#9470ff)" }}
              aria-hidden="true"
            />

            <div className="relative rounded-xl border border-[#272b33] bg-[#111317] shadow-2xl shadow-black/60 overflow-hidden">
              {/* Window chrome header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c1f25] bg-[#0d0f12]">
                <div className="flex items-center gap-2">
                  {/* Traffic light dots */}
                  <span className="w-3 h-3 rounded-full bg-[#ef4444] opacity-80" />
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b] opacity-80" />
                  <span className="w-3 h-3 rounded-full bg-[#10b981] opacity-80" />
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6b7280] font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" aria-hidden="true" />
                  DevPilot AI&nbsp;&middot;&nbsp;Workspace: Engineering Docs
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#6b7280] bg-[#181b20] border border-[#272b33] rounded px-2 py-0.5 font-mono hidden sm:block">
                    gpt-4o-mini
                  </span>
                </div>
              </div>

              {/* Chat body */}
              <div className="p-5 sm:p-6 flex flex-col gap-4 min-h-[200px]">
                {/* User message — right aligned */}
                <div className="flex justify-end">
                  <div className="max-w-sm">
                    <div className="rounded-xl rounded-tr-sm bg-[#7c4dff] px-4 py-2.5 text-sm text-white shadow-lg shadow-[#7c4dff]/20 leading-relaxed">
                      How does our authentication system handle token refresh?
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1 text-right">You &middot; just now</p>
                  </div>
                </div>

                {/* Assistant message — left aligned */}
                <div className="flex justify-start">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7c4dff]/20 border border-[#7c4dff]/30">
                        <Icon name="sparkles" size={12} className="text-[#9470ff]" />
                      </div>
                      <span className="text-xs font-medium text-[#a0a6b0]">DevPilot AI</span>
                      <span className="text-xs text-[#6b7280]">&middot; 3 sources</span>
                    </div>
                    <div className="rounded-xl rounded-tl-sm bg-[#181b20] border border-[#272b33] px-4 py-3 text-sm text-[#ecedee] leading-relaxed shadow-sm">
                      <p>
                        Based on{" "}
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#7c4dff]/20 border border-[#7c4dff]/30 text-[#9470ff] text-xs font-bold leading-none align-text-bottom">
                          1
                        </span>{" "}
                        and{" "}
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#7c4dff]/20 border border-[#7c4dff]/30 text-[#9470ff] text-xs font-bold leading-none align-text-bottom">
                          2
                        </span>
                        , the token refresh flow uses a sliding window approach with a 7-day
                        refresh token lifetime. When the access token expires, the client sends
                        the refresh token to{" "}
                        <code className="text-[#9470ff] bg-[#0a0b0e] rounded px-1 py-0.5 text-xs font-mono">
                          /api/auth/refresh
                        </code>
                        , which rotates both tokens to prevent replay attacks.
                      </p>

                      {/* Citation chips */}
                      <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-[#1c1f25]">
                        <span className="text-xs text-[#6b7280] font-medium">Sources:</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#0a0b0e] border border-[#272b33] text-[#9470ff] text-xs px-2 py-1 font-mono hover:border-[#7c4dff]/40 transition-colors">
                          <Icon name="fileText" size={11} />
                          [1] auth-service.md
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#0a0b0e] border border-[#272b33] text-[#9470ff] text-xs px-2 py-1 font-mono hover:border-[#7c4dff]/40 transition-colors">
                          <Icon name="fileText" size={11} />
                          [2] token-strategy.md
                        </span>
                      </div>
                    </div>

                    {/* Metrics strip */}
                    <div className="flex items-center gap-4 mt-2 px-1">
                      <span className="flex items-center gap-1 text-xs text-[#6b7280]">
                        <Icon name="checkCircle" size={11} className="text-[#10b981]" />
                        Faithfulness 0.94
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#6b7280]">
                        <Icon name="activity" size={11} className="text-[#3b82f6]" />
                        Relevance 0.91
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#6b7280]">
                        <Icon name="clock" size={11} />
                        1.2s
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="px-5 sm:px-6 pb-5">
                <div className="flex items-center gap-3 rounded-lg border border-[#272b33] bg-[#0a0b0e] px-4 py-2.5">
                  <input
                    className="flex-1 bg-transparent text-sm text-[#6b7280] placeholder:text-[#6b7280] outline-none cursor-default"
                    placeholder="Ask anything about your documentation..."
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#6b7280] hidden sm:block font-mono">⌘ Enter</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#7c4dff] hover:bg-[#9470ff] transition-colors">
                      <Icon name="arrowRight" size={13} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
