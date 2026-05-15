"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { LoadingState } from "@/components/LoadingState";
import { AiConfigCard } from "@/components/settings/AiConfigCard";
import { ApiStatusCard } from "@/components/settings/ApiStatusCard";
import { AuthDebugCard } from "@/components/settings/AuthDebugCard";
import { DangerZoneCard } from "@/components/settings/DangerZoneCard";
import { FrontendConfigCard } from "@/components/settings/FrontendConfigCard";
import { UserCard } from "@/components/settings/UserCard";
import { WorkspaceCard } from "@/components/settings/WorkspaceCard";
import {
  checkLocalStorageAvailable,
  displayValue,
  formatNow,
  getConfigValue,
  maskSensitiveConfig,
} from "@/components/settings/settingsUtils";
import { API_BASE_URL, ApiRequestError, apiGet } from "@/lib/api";
import { TOKEN_STORAGE_KEY, getToken, removeToken } from "@/lib/auth";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces";
import type { HealthResponse, User, Workspace } from "@/types";

type TokenValidationStatus = "idle" | "valid" | "invalid";

const DEFAULT_WORKSPACE_PAYLOAD = {
  description: "Default workspace created from settings page",
  name: "Default Workspace",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function asSafeConfig(config: unknown) {
  const maskedConfig = maskSensitiveConfig(config);

  if (
    maskedConfig &&
    typeof maskedConfig === "object" &&
    !Array.isArray(maskedConfig)
  ) {
    return maskedConfig as Record<string, unknown>;
  }

  return {};
}

export default function SettingsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [aiConfig, setAiConfig] = useState<Record<string, unknown> | null>(null);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [aiConfigLoading, setAiConfigLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [frontendOrigin, setFrontendOrigin] = useState<string>("Not available");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLastChecked, setHealthLastChecked] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isLocalStorageAvailable, setIsLocalStorageAvailable] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenExists, setTokenExists] = useState(false);
  const [tokenValidationStatus, setTokenValidationStatus] =
    useState<TokenValidationStatus>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const currentRoute = pathname ?? "/settings";

  const handleUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        removeToken();
        setTokenExists(false);
        router.replace("/login");
        return true;
      }

      return false;
    },
    [router],
  );

  const refreshUser = useCallback(async () => {
    const token = getToken();
    setTokenExists(Boolean(token));

    if (!token) {
      router.replace("/login");
      return;
    }

    setUserLoading(true);
    setUserError(null);

    try {
      setUser(await apiGet<User>("/api/v1/auth/me", { token }));
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setUserError(
        getErrorMessage(
          error,
          "Failed to load the current authenticated user.",
        ),
      );
    } finally {
      setUserLoading(false);
    }
  }, [handleUnauthorized, router]);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);

    try {
      setHealth(await apiGet<HealthResponse>("/health", { token: null }));
    } catch {
      setHealth(null);
      setHealthError(
        "Backend unavailable. Check that backend is running on NEXT_PUBLIC_API_URL.",
      );
    } finally {
      setHealthLastChecked(formatNow());
      setHealthLoading(false);
    }
  }, []);

  const refreshAiConfig = useCallback(async () => {
    setAiConfigLoading(true);
    setAiConfigError(null);

    try {
      const response = await apiGet<Record<string, unknown>>(
        "/api/v1/system/ai-config",
      );
      setAiConfig(asSafeConfig(response));
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setAiConfig(null);
      setAiConfigError("Failed to load AI config.");
    } finally {
      setAiConfigLoading(false);
    }
  }, [handleUnauthorized]);

  const refreshWorkspaces = useCallback(async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    try {
      setWorkspaces(await listWorkspaces());
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setWorkspaces([]);
      setWorkspaceError("Failed to load workspace.");
    } finally {
      setWorkspaceLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    setIsLocalStorageAvailable(checkLocalStorageAvailable());
    setTokenExists(Boolean(getToken()));

    if (typeof window !== "undefined") {
      setFrontendOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const token = getToken();

    if (!token) {
      setTokenExists(false);
      router.replace("/login");
      return () => {
        isMounted = false;
      };
    }

    setTokenExists(true);
    setUserLoading(true);
    setUserError(null);

    async function checkAuth() {
      try {
        const currentUser = await apiGet<User>("/api/v1/auth/me", { token });

        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          removeToken();

          if (isMounted) {
            setTokenExists(false);
          }

          router.replace("/login");
          return;
        }

        if (isMounted) {
          setUser(null);
          setUserError(
            "Unable to verify authentication. Check that the API is running.",
          );
        }
      } finally {
        if (isMounted) {
          setUserLoading(false);
          setIsCheckingAuth(false);
        }
      }
    }

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (isCheckingAuth || !tokenExists) {
      return;
    }

    void refreshHealth();
    void refreshAiConfig();
    void refreshWorkspaces();
  }, [
    isCheckingAuth,
    refreshAiConfig,
    refreshHealth,
    refreshWorkspaces,
    tokenExists,
  ]);

  async function handleCreateDefaultWorkspace() {
    setIsCreatingWorkspace(true);
    setWorkspaceError(null);

    try {
      const workspace = await createWorkspace(DEFAULT_WORKSPACE_PAYLOAD);
      setWorkspaces((current) => [workspace, ...current]);
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setWorkspaceError("Failed to create default workspace.");
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function handleValidateToken() {
    const token = getToken();
    setCopyStatus(null);
    setTokenExists(Boolean(token));
    setTokenValidationStatus("idle");

    if (!token) {
      setTokenValidationStatus("invalid");
      return;
    }

    setIsValidatingToken(true);

    try {
      await apiGet<User>("/api/v1/auth/me", { token });
      setTokenValidationStatus("valid");
    } catch (error) {
      setTokenValidationStatus("invalid");

      if (handleUnauthorized(error)) {
        return;
      }
    } finally {
      setIsValidatingToken(false);
    }
  }

  function handleClearToken() {
    removeToken();
    setTokenExists(false);
    router.replace("/login");
  }

  async function handleCopyDiagnostic() {
    const frontendUrl =
      frontendOrigin === "Not available"
        ? currentRoute
        : `${frontendOrigin}${currentRoute}`;
    const diagnosticSummary = [
      "DevPilot AI Diagnostics",
      `Frontend URL: ${frontendUrl}`,
      `API URL: ${API_BASE_URL}`,
      `Auth token exists: ${getToken() ? "yes" : "no"}`,
      `User email: ${displayValue(user?.email)}`,
      `LLM provider: ${displayValue(getConfigValue(aiConfig, "llm_provider"))}`,
      `Generation model: ${displayValue(
        getConfigValue(aiConfig, "generation_model"),
      )}`,
      `Embedding provider: ${displayValue(
        getConfigValue(aiConfig, "embedding_provider"),
      )}`,
      `Embedding model: ${displayValue(getConfigValue(aiConfig, "embedding_model"))}`,
      `Reranking enabled: ${displayValue(
        getConfigValue(aiConfig, "enable_reranking"),
      )}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(diagnosticSummary);
      setCopyStatus("Diagnostic summary copied.");
    } catch {
      setCopyStatus("Unable to copy diagnostic summary from this browser.");
    }
  }

  function handleLogout() {
    removeToken();
    setTokenExists(false);
    router.replace("/login");
  }

  if (isCheckingAuth) {
    return (
      <DashboardShell
        activeItem="settings"
        title="Settings"
        description="System configuration, authentication, and runtime diagnostics."
      >
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Checking authentication..." />
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="settings"
      title="Settings"
      description="System configuration, authentication, and runtime diagnostics."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <UserCard
          error={userError}
          isLoading={userLoading}
          onRefresh={refreshUser}
          user={user}
        />
        <ApiStatusCard
          apiUrl={API_BASE_URL}
          data={health}
          error={healthError}
          isLoading={healthLoading}
          lastChecked={healthLastChecked}
          onRefresh={refreshHealth}
        />
        <AiConfigCard
          config={aiConfig}
          error={aiConfigError}
          isLoading={aiConfigLoading}
          onRefresh={refreshAiConfig}
        />
        <WorkspaceCard
          currentUserId={user?.id ?? null}
          error={workspaceError}
          isCreatingDefault={isCreatingWorkspace}
          isLoading={workspaceLoading}
          onCreateDefault={handleCreateDefaultWorkspace}
          onRefresh={refreshWorkspaces}
          workspaces={workspaces}
        />
        <FrontendConfigCard
          apiUrl={API_BASE_URL}
          currentRoute={currentRoute}
          frontendOrigin={frontendOrigin}
          localStorageAvailable={isLocalStorageAvailable}
          tokenExists={tokenExists}
          tokenKey={TOKEN_STORAGE_KEY}
        />
        <AuthDebugCard
          copyStatus={copyStatus}
          isValidating={isValidatingToken}
          onClearToken={handleClearToken}
          onCopyDiagnostic={handleCopyDiagnostic}
          onValidateToken={handleValidateToken}
          validationStatus={tokenValidationStatus}
        />
        <DangerZoneCard className="lg:col-span-2" onLogout={handleLogout} />
      </div>
    </DashboardShell>
  );
}
