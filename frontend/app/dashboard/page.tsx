"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import {
  ApiConnectionError,
  ApiRequestError,
  apiGet,
} from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { listWorkspaceConversations } from "@/lib/chat";
import { listDocuments } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces";
import type {
  ConversationSummary,
  Document,
  DocumentStatus,
  HealthResponse,
  Workspace,
} from "@/types";

type WorkspaceDashboardRow = {
  conversations: ConversationSummary[];
  documents: Document[];
  lastActivityAt: string | null;
  workspace: Workspace;
};

type RecentConversation = ConversationSummary & {
  workspaceName: string;
};

type StatusSegment = {
  color: string;
  count: number;
  label: string;
  status: string;
};

const statusColors = {
  failed: "#dc2626",
  indexed: "#059669",
  processing: "#2563eb",
  queued: "#d97706",
} as const;

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function latestDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function asDisplayValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "Not available";
}

function buildConicGradient(segments: StatusSegment[], total: number) {
  if (total <= 0) {
    return "#e2e8f0";
  }

  let cursor = 0;
  const parts = segments
    .filter((segment) => segment.count > 0)
    .map((segment) => {
      const start = cursor;
      const end = cursor + (segment.count / total) * 360;
      cursor = end;
      return `${segment.color} ${start}deg ${end}deg`;
    });

  return parts.length > 0 ? `conic-gradient(${parts.join(", ")})` : "#e2e8f0";
}

function ActionLink({
  children,
  href,
  variant = "primary",
}: {
  children: string;
  href: string;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
      : "inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function DocumentStatusVisual({
  segments,
  total,
}: {
  segments: StatusSegment[];
  total: number;
}) {
  if (total === 0) {
    return (
      <EmptyState
        title="No document activity yet"
        description="Document status appears here after you upload files to a workspace."
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
      <div className="mx-auto grid h-40 w-40 place-items-center rounded-full bg-slate-100">
        <div
          className="grid h-40 w-40 place-items-center rounded-full"
          style={{ background: buildConicGradient(segments, total) }}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-sm">
            <div>
              <p className="text-2xl font-semibold text-slate-950">{total}</p>
              <p className="text-xs text-slate-500">documents</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {segments.map((segment) => {
          const percent = total > 0 ? Math.round((segment.count / total) * 100) : 0;

          return (
            <div key={segment.status}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="font-medium text-slate-700">
                    {segment.label}
                  </span>
                </div>
                <span className="text-slate-500">
                  {segment.count} · {percent}%
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    backgroundColor: segment.color,
                    width: `${percent}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GettingStartedPanel({ hasNoData }: { hasNoData: boolean }) {
  if (!hasNoData) {
    return null;
  }

  const steps = [
    {
      detail: "Create a workspace to keep documents and chat history grouped.",
      label: "Create workspace",
    },
    {
      detail: "Upload a PDF, text, or source document so DevPilot can index it.",
      label: "Upload document",
    },
    {
      detail: "Ask a question and review citations, evaluation, and trace data.",
      label: "Ask question",
    },
  ];

  return (
    <Card id="getting-started" className="border-slate-300">
      <CardHeader
        title="Getting started"
        description="Complete these steps to turn DevPilot AI into a usable RAG workspace."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.label} className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">
              {index + 1}
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-950">
              {step.label}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const [aiConfig, setAiConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [partialWarnings, setPartialWarnings] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceRows, setWorkspaceRows] = useState<WorkspaceDashboardRow[]>([]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    async function loadDashboard() {
      setIsLoadingDashboard(true);
      setError(null);
      setPartialWarnings([]);

      const [workspaceResult, healthResult, aiConfigResult] =
        await Promise.allSettled([
          listWorkspaces(),
          apiGet<HealthResponse>("/health", { token: null }),
          apiGet<Record<string, unknown>>("/api/v1/system/ai-config"),
        ]);

      if (!isMounted) {
        return;
      }

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      } else {
        setHealth(null);
      }

      if (aiConfigResult.status === "fulfilled") {
        setAiConfig(aiConfigResult.value);
      } else {
        setAiConfig(null);
      }

      if (workspaceResult.status === "rejected") {
        if (
          workspaceResult.reason instanceof ApiRequestError &&
          workspaceResult.reason.status === 401
        ) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(
          requestErrorMessage(
            workspaceResult.reason,
            "Unable to load dashboard data.",
          ),
        );
        setWorkspaceRows([]);
        setIsLoadingDashboard(false);
        return;
      }

      const warnings: string[] = [];
      const rows = await Promise.all(
        workspaceResult.value.map(async (workspace) => {
          const [documentsResult, conversationsResult] = await Promise.allSettled([
            listDocuments(workspace.id),
            listWorkspaceConversations(workspace.id),
          ]);

          const documents =
            documentsResult.status === "fulfilled" ? documentsResult.value : [];
          const conversations =
            conversationsResult.status === "fulfilled"
              ? conversationsResult.value
              : [];

          if (documentsResult.status === "rejected") {
            warnings.push(`Documents unavailable for ${workspace.name}.`);
          }

          if (conversationsResult.status === "rejected") {
            warnings.push(`Conversations unavailable for ${workspace.name}.`);
          }

          return {
            conversations,
            documents,
            lastActivityAt: latestDate([
              workspace.updated_at,
              ...documents.map((document) => document.processed_at ?? document.created_at),
              ...conversations.map((conversation) => conversation.updated_at),
            ]),
            workspace,
          };
        }),
      );

      if (!isMounted) {
        return;
      }

      setWorkspaceRows(rows);
      setPartialWarnings(warnings);
      setIsLoadingDashboard(false);
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [reloadKey, router, user]);

  const dashboardSummary = useMemo(() => {
    const documents = workspaceRows.flatMap((row) => row.documents);
    const activeDocuments = documents.filter((document) => document.status !== "deleted");
    const conversations = workspaceRows.flatMap((row) =>
      row.conversations.map((conversation) => ({
        ...conversation,
        workspaceName: row.workspace.name,
      })),
    );

    const countStatus = (statuses: DocumentStatus[]) =>
      activeDocuments.filter((document) => statuses.includes(document.status)).length;

    const indexedCount = countStatus(["indexed"]);
    const queuedCount = countStatus(["queued", "uploaded"]);
    const processingCount = countStatus(["processing"]);
    const failedCount = countStatus(["failed"]);

    const recentWorkspaces = [...workspaceRows]
      .sort(
        (left, right) =>
          new Date(right.lastActivityAt ?? right.workspace.updated_at).getTime() -
          new Date(left.lastActivityAt ?? left.workspace.updated_at).getTime(),
      )
      .slice(0, 4);

    const recentConversations = [...conversations]
      .sort(
        (left, right) =>
          new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      )
      .slice(0, 6);

    return {
      activeDocuments,
      failedCount,
      indexedCount,
      processingCount,
      queuedCount,
      recentConversations,
      recentWorkspaces,
      totalConversations: conversations.length,
      totalDocuments: activeDocuments.length,
      totalWorkspaces: workspaceRows.length,
    };
  }, [workspaceRows]);

  const primaryWorkspace =
    dashboardSummary.recentWorkspaces[0]?.workspace ?? workspaceRows[0]?.workspace ?? null;
  const hasNoData =
    dashboardSummary.totalWorkspaces === 0 &&
    dashboardSummary.totalDocuments === 0 &&
    dashboardSummary.totalConversations === 0;
  const uploadHref = primaryWorkspace
    ? `/workspaces/${primaryWorkspace.id}/documents`
    : "#getting-started";
  const askHref = primaryWorkspace
    ? `/workspaces/${primaryWorkspace.id}/chat`
    : "#getting-started";

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const workspace = await createWorkspace({
        description: workspaceDescription || null,
        name: workspaceName,
      });

      setWorkspaceRows((current) => [
        {
          conversations: [],
          documents: [],
          lastActivityAt: workspace.updated_at,
          workspace,
        },
        ...current,
      ]);
      setWorkspaceDescription("");
      setWorkspaceName("");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        removeToken();
        router.replace("/login");
        return;
      }

      setError(
        requestErrorMessage(
          requestError,
          "Unable to create the workspace. Check that the API is running.",
        ),
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (isAuthLoading) {
    return (
      <DashboardShell
        activeItem="dashboard"
        title="Dashboard"
        description="Loading your workspace overview."
      >
        <LoadingSkeleton label="Loading dashboard" rows={6} />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell
        activeItem="dashboard"
        title="Dashboard"
        description="Your workspace overview."
      >
        <ErrorState
          action={
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
          message={authError ?? "Your session expired. Please login again."}
          title="Unable to load dashboard"
        />
      </DashboardShell>
    );
  }

  const statusSegments: StatusSegment[] = [
    {
      color: statusColors.indexed,
      count: dashboardSummary.indexedCount,
      label: "Indexed",
      status: "indexed",
    },
    {
      color: statusColors.queued,
      count: dashboardSummary.queuedCount,
      label: "Queued",
      status: "queued",
    },
    {
      color: statusColors.processing,
      count: dashboardSummary.processingCount,
      label: "Processing",
      status: "processing",
    },
    {
      color: statusColors.failed,
      count: dashboardSummary.failedCount,
      label: "Failed",
      status: "failed",
    },
  ];

  return (
    <DashboardShell
      activeItem="dashboard"
      title="Dashboard"
      description="Your workspaces, documents, questions, and platform readiness in one place."
    >
      <div className="grid gap-6">
        <ErrorState message={authError} title="Authentication warning" />
        <ErrorState
          action={
            error ? (
              <Button type="button" variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
                Retry
              </Button>
            ) : undefined
          }
          message={error}
        />

        {partialWarnings.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-900">
              Some dashboard data could not be loaded.
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              {partialWarnings.slice(0, 3).join(" ")}
            </p>
          </Card>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Badge tone="ai">DevPilot AI Workspace</Badge>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                Welcome back, {user.full_name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Monitor your RAG workspace activity, check indexing progress, and
                continue asking questions against your documents.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <ActionLink href="#create-workspace">Create workspace</ActionLink>
              <ActionLink href={uploadHref} variant="secondary">
                Upload document
              </ActionLink>
              <ActionLink href={askHref} variant="secondary">
                Ask a question
              </ActionLink>
            </div>
          </div>
        </section>

        {isLoadingDashboard ? (
          <LoadingSkeleton label="Loading dashboard metrics" rows={6} />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard
                label="My Workspaces"
                value={String(dashboardSummary.totalWorkspaces)}
                description="Accessible knowledge spaces."
              />
              <StatCard
                label="My Documents"
                value={String(dashboardSummary.totalDocuments)}
                description="Uploaded active documents."
              />
              <StatCard
                label="Indexed Documents"
                value={String(dashboardSummary.indexedCount)}
                description="Ready for retrieval."
                tone="success"
                badge="ready"
              />
              <StatCard
                label="Processing Documents"
                value={String(
                  dashboardSummary.processingCount + dashboardSummary.queuedCount,
                )}
                description="Queued or being indexed."
                tone="warning"
                badge="in flight"
              />
              <StatCard
                label="Failed Documents"
                value={String(dashboardSummary.failedCount)}
                description="Need attention."
                tone={dashboardSummary.failedCount > 0 ? "critical" : "success"}
                badge={dashboardSummary.failedCount > 0 ? "review" : "clear"}
              />
              <StatCard
                label="Recent Questions"
                value={String(dashboardSummary.totalConversations)}
                description="Conversation threads."
              />
            </section>

            <GettingStartedPanel hasNoData={hasNoData} />

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader
                  title="Document Status"
                  description="Indexing state across your active documents."
                />
                <DocumentStatusVisual
                  segments={statusSegments}
                  total={dashboardSummary.totalDocuments}
                />
              </Card>

              <Card>
                <CardHeader
                  title="System Status"
                  description="Backend and AI runtime summary."
                />
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        Backend
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {health?.service ?? health?.app ?? "API health"}
                      </p>
                    </div>
                    <StatusBadge
                      status={health?.status ?? "unavailable"}
                      tone={health?.status === "ok" ? "success" : "warning"}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Generation provider
                      </p>
                      <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
                        {asDisplayValue(aiConfig?.llm_provider)}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {asDisplayValue(aiConfig?.generation_model)}
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Embedding provider
                      </p>
                      <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
                        {asDisplayValue(aiConfig?.embedding_provider)}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {asDisplayValue(aiConfig?.embedding_model)}
                      </p>
                    </div>
                  </div>

                  {!aiConfig ? (
                    <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs leading-5 text-slate-500">
                      AI configuration is unavailable from the current API. The
                      dashboard is still usable.
                    </p>
                  ) : null}
                </div>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader
                  title="Recent Workspaces"
                  description="Workspaces with document and chat activity."
                />
                {dashboardSummary.recentWorkspaces.length === 0 ? (
                  <EmptyState
                    title="No workspaces yet"
                    description="Create your first workspace to start uploading documents."
                    action={
                      <ActionLink href="#create-workspace">Create workspace</ActionLink>
                    }
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dashboardSummary.recentWorkspaces.map((row) => (
                      <article
                        key={row.workspace.id}
                        className="rounded-md border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-slate-950">
                              {row.workspace.name}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                              {row.workspace.description ?? "No description"}
                            </p>
                          </div>
                          <StatusBadge
                            label={`${row.documents.filter((document) => document.status !== "deleted").length} docs`}
                            tone="neutral"
                          />
                        </div>
                        <p className="mt-4 text-xs text-slate-500">
                          Last activity: {formatDate(row.lastActivityAt)}
                        </p>
                        <Link
                          href={`/workspaces/${row.workspace.id}`}
                          className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Open workspace
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </Card>

              <Card id="create-workspace">
                <CardHeader
                  title="Create Workspace"
                  description="Start a new knowledge area for documents and questions."
                />
                <form onSubmit={handleCreateWorkspace} className="grid gap-3">
                  <Input
                    label="Workspace name"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    required
                  />
                  <Textarea
                    label="Description"
                    value={workspaceDescription}
                    onChange={(event) => setWorkspaceDescription(event.target.value)}
                    rows={4}
                  />
                  <Button type="submit" isLoading={isCreating}>
                    {isCreating ? "Creating..." : "Create workspace"}
                  </Button>
                </form>
              </Card>
            </section>

            <Card>
              <CardHeader
                title="Recent Conversations"
                description="Recent question threads across your workspaces."
              />
              {dashboardSummary.recentConversations.length === 0 ? (
                <EmptyState
                  title="No recent questions"
                  description="Ask a question after uploading an indexed document."
                  action={
                    <ActionLink href={askHref} variant="secondary">
                      Ask a question
                    </ActionLink>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Question</th>
                        <th className="px-4 py-3">Workspace</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dashboardSummary.recentConversations.map(
                        (conversation: RecentConversation) => (
                          <tr key={conversation.id}>
                            <td className="max-w-[420px] truncate px-4 py-3 font-medium text-slate-950">
                              {conversation.title ?? "Untitled question"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {conversation.workspaceName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {formatDate(conversation.updated_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/workspaces/${conversation.workspace_id}/chat`}
                                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                Open chat
                              </Link>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
