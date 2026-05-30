import Link from "next/link";
import { ApiStatus } from "@/components/ApiStatus";
import { Navbar } from "@/components/Navbar";

const workspaceStats = [
  { label: "Workspaces", value: "Ready", detail: "Multi-tenant API" },
  { label: "Retrieval", value: "Hybrid", detail: "Semantic and keyword" },
  { label: "Reranking", value: "Enabled", detail: "Candidate filtering" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <Navbar />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <p className="text-sm font-medium text-brand-fg">
            Phase 16 frontend
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-fg">
            DevPilot AI workspace
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-muted">
            A clean Next.js shell for document search, retrieval, answer
            evaluation, and agent workflow visibility.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Open dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-fg-muted hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Login
            </Link>
          </div>
        </div>

        <ApiStatus />
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-8 md:grid-cols-3">
        {workspaceStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-line bg-surface p-5 shadow-sm"
          >
            <p className="text-sm text-fg-subtle">{stat.label}</p>
            <p className="mt-2 text-xl font-semibold text-fg">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-fg-muted">{stat.detail}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
