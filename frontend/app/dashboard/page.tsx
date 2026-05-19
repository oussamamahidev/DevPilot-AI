"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { LoadingState } from "@/components/LoadingState";
import { ApiRequestError } from "@/lib/api";
import { removeToken } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces";
import type { DashboardMetric, Workspace } from "@/types";

const metrics: DashboardMetric[] = [
  {
    label: "Workspaces",
    value: "0",
    detail: "Active workspaces you can access.",
  },
  {
    label: "Chat",
    value: "Ready",
    detail: "Backend connectivity is available.",
  },
  {
    label: "Evaluation",
    value: "Enabled",
    detail: "Answer quality metadata is exposed by the API.",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    async function loadWorkspaces() {
      try {
        const response = await listWorkspaces();

        if (isMounted) {
          setWorkspaces(response);
          setError(null);
          setIsLoadingWorkspaces(false);
        }
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        if (requestError instanceof ApiRequestError) {
          if (requestError.status === 401) {
            removeToken();
            router.replace("/login");
            return;
          }

          setError(requestError.message);
        } else {
          setError("Unable to reach the backend. Check that the API is running.");
        }

        setIsLoadingWorkspaces(false);
      }
    }

    void loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [router, user]);

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

      setWorkspaces((current) => [workspace, ...current]);
      setWorkspaceDescription("");
      setWorkspaceName("");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(requestError.message);
      } else {
        setError("Unable to create the workspace. Check that the API is running.");
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRefreshWorkspaces() {
    setIsLoadingWorkspaces(true);
    setError(null);

    try {
      setWorkspaces(await listWorkspaces());
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(requestError.message);
      } else {
        setError("Unable to load workspaces. Check that the API is running.");
      }
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }

  function handleLogout() {
    logout();
  }

  if (isAuthLoading || !user) {
    return (
      <DashboardShell
        activeItem="dashboard"
        title="Dashboard"
        description="Loading your authenticated workspace."
      >
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Loading dashboard" />
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="dashboard"
      title="Dashboard"
      description="Workspace shell for documents, retrieval, generated answers, and evaluation signals."
    >
      {authError ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {authError}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {user ? (
        <section className="mb-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Signed in as</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {user.full_name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-1 font-medium capitalize text-slate-950">
                {user.role}
              </dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {user.is_active ? "Active" : "Inactive"}
              </dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">User ID</dt>
              <dd className="mt-1 truncate font-medium text-slate-950">
                {user.id}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const value =
            metric.label === "Workspaces" ? String(workspaces.length) : metric.value;

          return (
            <section
              key={metric.label}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {metric.detail}
              </p>
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section
          id="workspaces"
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Workspaces
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Open a workspace to manage documents and chat.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshWorkspaces}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5">
            {isLoadingWorkspaces ? (
              <LoadingState label="Loading workspaces" />
            ) : workspaces.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No workspaces yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/workspaces/${workspace.id}`}
                    className="rounded-md border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-medium text-slate-950">
                          {workspace.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {workspace.description ?? "No description"}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {workspace.members.length} member
                        {workspace.members.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <form
          onSubmit={handleCreateWorkspace}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-950">
            Create workspace
          </h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Name
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Description
              <textarea
                value={workspaceDescription}
                onChange={(event) => setWorkspaceDescription(event.target.value)}
                rows={4}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <button
              type="submit"
              disabled={isCreating}
              className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isCreating ? "Creating..." : "Create workspace"}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
