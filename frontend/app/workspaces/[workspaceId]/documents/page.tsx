"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { LoadingState } from "@/components/LoadingState";
import { WorkspaceDocumentsPanel } from "@/components/WorkspaceDocumentsPanel";
import { ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getWorkspace } from "@/lib/workspaces";
import type { Workspace } from "@/types";

export default function WorkspaceDocumentsPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user || !workspaceId) {
      return;
    }

    async function loadWorkspace() {
      try {
        const response = await getWorkspace(workspaceId);

        if (isMounted) {
          setWorkspace(response);
          setError(null);
          setIsLoadingWorkspace(false);
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
          setError("Unable to load the workspace. Check that the API is running.");
        }

        setIsLoadingWorkspace(false);
      }
    }

    void loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [router, user, workspaceId]);

  if (isAuthLoading || (user && isLoadingWorkspace)) {
    return (
      <DashboardShell
        activeItem="documents"
        title="Documents"
        workspaceId={workspaceId}
      >
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Loading documents" />
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="documents"
      title="Documents"
      description={
        workspace
          ? `Upload and monitor documents for ${workspace.name}.`
          : "Upload and monitor workspace documents."
      }
      workspaceId={workspaceId}
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

      {user && workspace ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/workspaces/${workspaceId}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Workspace overview
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/chat`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Open chat
          </Link>
        </div>
      ) : null}

      {user && workspace ? (
        <WorkspaceDocumentsPanel showUpload workspaceId={workspaceId} />
      ) : null}
    </DashboardShell>
  );
}
