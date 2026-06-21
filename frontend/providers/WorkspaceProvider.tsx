"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listWorkspaces } from "@/lib/workspaces";
import type { Workspace } from "@/types";
import { useAuth } from "@/hooks/useAuth";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  refresh: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const ACTIVE_KEY = "dp-active-workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await listWorkspaces();
      setWorkspaces(items ?? []);
    } catch {
      // Unauthenticated or offline — keep the shell resilient.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void load();
    } else {
      setWorkspaces([]);
    }
  }, [isAuthenticated, load]);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_KEY);
    if (stored) {
      setActiveId(stored);
    }
  }, []);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null,
    [workspaces, activeId],
  );

  const value = useMemo(
    () => ({ workspaces, activeWorkspace, setActiveWorkspaceId, isLoading, refresh: load }),
    [workspaces, activeWorkspace, setActiveWorkspaceId, isLoading, load],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaces() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaces must be used within WorkspaceProvider");
  }
  return ctx;
}
