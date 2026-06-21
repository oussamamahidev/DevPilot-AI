"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useAuthUser } from "@/hooks/useAuthUser";
import { C } from "@/features/ai-execution-studio/constants";

function StudioLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-28" style={{ color: C.muted }}>
      <Icon name="loader" size={24} className="motion-safe:animate-spin" style={{ color: "#a855f7" }} />
      <span className="text-sm">Loading the execution studio…</span>
    </div>
  );
}

// Lazy-loaded: the studio (Framer Motion + canvas) is client-only and code-split.
const Studio = dynamic(
  () => import("@/features/ai-execution-studio/components/Studio").then((m) => m.Studio),
  { ssr: false, loading: () => <StudioLoader /> },
);

export default function AiExecutionStudioPage() {
  const { user, isLoading } = useAuthUser();

  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ background: C.bg, color: C.text }}>
      <header
        className="sticky top-0 z-20 flex h-14 items-center gap-3 px-4 sm:px-6"
        style={{ background: `${C.bg}cc`, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
      >
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm" style={{ color: C.muted }}>
          <Icon name="arrowLeft" size={16} /> DevPilot
        </Link>
        <span style={{ color: C.border }}>/</span>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg"
            style={{ background: "#6a35f01f", border: "1px solid #6a35f0", color: "#a855f7" }}
          >
            <Icon name="zap" size={15} />
          </span>
          <h1 className="truncate text-sm font-semibold" style={{ color: C.text }}>
            AI Execution Studio
          </h1>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] sm:inline-flex" style={{ color: C.subtle }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} /> Live pipeline · real data
        </span>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
        {isLoading ? (
          <StudioLoader />
        ) : !user ? (
          <div className="grid place-items-center gap-3 py-28 text-center">
            <Icon name="lock" size={24} style={{ color: C.subtle }} />
            <p className="text-sm" style={{ color: C.muted }}>
              Please{" "}
              <Link href="/login" className="underline" style={{ color: "#a855f7" }}>
                sign in
              </Link>{" "}
              to run the execution studio.
            </p>
          </div>
        ) : (
          <Studio />
        )}
      </main>
    </div>
  );
}
