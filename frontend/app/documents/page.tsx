"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { LoadingState } from "@/components/LoadingState";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function DocumentsPage() {
  const { isLoading, user } = useAuthUser();

  if (isLoading || !user) {
    return (
      <DashboardShell
        activeItem="documents"
        title="Documents"
        description="Loading document access."
      >
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Checking authentication" />
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="documents"
      title="Documents"
      description="Open a workspace to upload and inspect indexed documents."
    >
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Workspace documents</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Documents are managed inside each workspace so indexing, chunking, and
          chat context stay scoped correctly.
        </p>
        <Link
          href="/dashboard#workspaces"
          className="mt-4 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        >
          Open workspaces
        </Link>
      </section>
    </DashboardShell>
  );
}
