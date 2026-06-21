const rows: {
  capability: string;
  generic: "check" | "cross" | "limited";
  devpilot: "check" | "cross" | "highlighted";
}[] = [
  { capability: "Document Citations",        generic: "cross",   devpilot: "check" },
  { capability: "Full Query Traceability",   generic: "cross",   devpilot: "check" },
  { capability: "Workspace Isolation",       generic: "cross",   devpilot: "check" },
  { capability: "Hallucination Scoring",     generic: "cross",   devpilot: "check" },
  { capability: "Retrieval Metrics",         generic: "cross",   devpilot: "check" },
  { capability: "Agent Execution Timeline",  generic: "cross",   devpilot: "check" },
  { capability: "Your Own Documents",        generic: "limited", devpilot: "highlighted" },
  { capability: "On-Premise Deployment",     generic: "cross",   devpilot: "check" },
];

function CheckMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#10b981]/10 flex items-center justify-center mx-auto">
      <span className="text-[#10b981] text-sm font-bold">✓</span>
    </div>
  );
}

function CrossMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto">
      <span className="text-[#ef4444] text-sm font-bold">✗</span>
    </div>
  );
}

function LimitedMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#f59e0b]/10 flex items-center justify-center mx-auto">
      <span className="text-[#f59e0b] text-xs font-semibold">~</span>
    </div>
  );
}

function HighlightedCheck() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#7c4dff]/20 flex items-center justify-center mx-auto ring-1 ring-[#7c4dff]/40">
      <span className="text-[#9470ff] text-sm font-bold">✓</span>
    </div>
  );
}

export default function WhyDifferentSection() {
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
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            Why Different
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee] mb-4">
            Not just another
            <br />
            chatbot wrapper
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] max-w-2xl mx-auto">
            DevPilot AI is purpose-built for engineering teams who need accurate, verifiable,
            observable AI — not a generic assistant.
          </p>
        </div>

        {/* Comparison table */}
        <div className="rounded-xl border border-[#272b33] bg-[#111317] overflow-hidden">
          {/* Header row */}
          <div className="bg-[#181b20] grid grid-cols-[2fr_1fr_1fr] px-6 py-4 border-b border-[#272b33]">
            <div className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider">
              Capability
            </div>
            <div className="text-center text-sm font-semibold text-[#a0a6b0]">
              Generic AI
              <span className="hidden sm:inline"> (ChatGPT, Copilot)</span>
            </div>
            <div className="relative text-center text-sm font-semibold text-[#7c4dff]">
              <div className="absolute inset-x-0 -top-4 -bottom-0 rounded-t-lg bg-gradient-to-b from-[#7c4dff]/20 to-transparent pointer-events-none" />
              <span className="relative z-10">DevPilot AI</span>
            </div>
          </div>

          {/* Data rows */}
          <div className="divide-y divide-[#1c1f25]">
            {rows.map(({ capability, generic, devpilot }, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[2fr_1fr_1fr] px-6 py-4 items-center hover:bg-[#181b20]/50 transition-colors"
              >
                <div className="text-sm font-medium text-[#ecedee]">{capability}</div>
                <div>
                  {generic === "check" ? (
                    <CheckMark />
                  ) : generic === "limited" ? (
                    <LimitedMark />
                  ) : (
                    <CrossMark />
                  )}
                </div>
                <div>
                  {devpilot === "highlighted" ? (
                    <HighlightedCheck />
                  ) : devpilot === "check" ? (
                    <CheckMark />
                  ) : (
                    <CrossMark />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-center text-[#6b7280] mt-4">
          DevPilot AI is open-source and self-hostable.
        </p>
      </div>
    </section>
  );
}
