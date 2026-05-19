"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { LoadingState } from "@/components/LoadingState";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function ChatPage() {
  const { isLoading, user } = useAuthUser();

  if (isLoading || !user) {
    return (
      <DashboardShell activeItem="chat" title="Chat" description="Loading chat access.">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Checking authentication" />
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="chat"
      title="Chat"
      description="Open a workspace chat to ask questions against indexed documents."
    >
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Workspace chat</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          RAG chat is workspace-scoped so every answer can be traced back to the
          right documents, chunks, citations, and evaluation records.
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
