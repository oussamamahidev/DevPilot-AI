"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, DataCard, Dialog, EmptyState, Input, LoadingState, Textarea } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAuthUser } from "@/hooks/useAuthUser";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces";
import type { Workspace } from "@/types";

function relTime(value: string): string {
  try {
    const diff = (Date.now() - new Date(value).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "";
  }
}

function QuickAction({ href, icon, title, description, onClick }: {
  href?: string;
  icon: IconName;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  const className =
    "group flex min-w-0 items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition hover:border-brand/40 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  const inner = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-subtle-line bg-brand-subtle text-brand-fg">
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block text-xs text-fg-muted">{description}</span>
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} className={className}>
      {inner}
    </Link>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-sunken text-fg-muted">
          <Icon name="box" size={17} />
        </span>
        <div className="min-w-0">
          <Link
            href={`/workspaces/${workspace.id}`}
            className="block truncate text-sm font-semibold text-fg hover:text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {workspace.name}
          </Link>
          <p className="truncate text-xs text-fg-subtle">
            {workspace.description?.trim() || "No description"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
        <span className="inline-flex items-center gap-1">
          <Icon name="user" size={12} /> {workspace.members.length} member{workspace.members.length !== 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="clock" size={12} /> {relTime(workspace.created_at)}
        </span>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link href={`/workspaces/${workspace.id}/chat`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="message" size={13} /> Chat
        </Link>
        <Link href={`/workspaces/${workspace.id}/documents`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="file" size={13} /> Documents
        </Link>
      </div>
    </div>
  );
}

export function PersonalDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => listWorkspaces(),
  });
  const workspaces = workspacesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createWorkspace({ name: name.trim(), description: description.trim() || null }),
    onSuccess: (workspace: Workspace) => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      router.push(`/workspaces/${workspace.id}`);
    },
  });

  const greeting = user?.full_name?.trim() || user?.email || "there";
  const createError =
    createMutation.error instanceof Error ? createMutation.error.message : createMutation.isError ? "Unable to create the workspace." : null;

  function openCreate() {
    setName("");
    setDescription("");
    createMutation.reset();
    setCreateOpen(true);
  }

  return (
    <DashboardShell activeItem="dashboard" title="Home" description={`Welcome back, ${greeting}.`}>
      <div className="grid min-w-0 gap-6">
        {/* Quick actions */}
        <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <QuickAction icon="plus" title="Create workspace" description="Start a new knowledge base" onClick={openCreate} />
          <QuickAction href="/documents" icon="cloudUpload" title="Upload documents" description="Add files to a workspace" />
          <QuickAction href="/chat" icon="message" title="Ask a question" description="Chat with your documents" />
        </section>

        {/* Workspaces */}
        <section id="workspaces" className="scroll-mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="layers" size={16} className="text-fg-muted" />
              <h2 className="text-sm font-semibold text-fg">Your workspaces</h2>
              <span className="rounded-full bg-sunken px-2 py-0.5 text-xs tabular-nums text-fg-muted">{workspaces.length}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={openCreate}>
              <Icon name="plus" size={15} /> New workspace
            </Button>
          </div>

          {workspacesQuery.isLoading ? (
            <LoadingState variant="skeleton" rows={2} skeletonVariant="card" />
          ) : workspacesQuery.isError ? (
            <DataCard title="Couldn't load workspaces">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-fg-muted">Something went wrong loading your workspaces.</p>
                <Button size="sm" variant="secondary" onClick={() => void workspacesQuery.refetch()}>
                  Retry
                </Button>
              </div>
            </DataCard>
          ) : workspaces.length === 0 ? (
            <EmptyState
              icon={<Icon name="box" size={22} />}
              title="Create your first workspace"
              description="Workspaces hold your documents and conversations. Create one to start uploading files and chatting with them."
              action={
                <Button onClick={openCreate}>
                  <Icon name="plus" size={15} /> Create workspace
                </Button>
              }
            />
          ) : (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workspaces.map((workspace) => (
                <WorkspaceCard key={workspace.id} workspace={workspace} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create workspace dialog */}
      <Dialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create workspace"
        tone="ai"
        icon={<Icon name="box" size={18} />}
        confirm={{
          label: createMutation.isPending ? "Creating…" : "Create workspace",
          onClick: () => createMutation.mutate(),
          isLoading: createMutation.isPending,
          disabled: name.trim().length === 0 || createMutation.isPending,
        }}
      >
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMutation.mutate();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Platform Architecture" autoFocus />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Description (optional)</span>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What lives in this workspace?" rows={3} />
          </label>
          {createError ? <p className="text-xs text-danger-fg">{createError}</p> : null}
        </form>
      </Dialog>
    </DashboardShell>
  );
}
