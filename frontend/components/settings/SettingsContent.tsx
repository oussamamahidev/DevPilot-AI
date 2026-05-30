"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  LoadingSkeleton,
  RoleBadge,
  StatusBadge,
} from "@/components/ui";
import { API_BASE_URL, ApiConnectionError, ApiRequestError, apiGet } from "@/lib/api-client";
import { getToken, removeToken } from "@/lib/auth";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import type { HealthResponse, User } from "@/types";

type SettingsState = {
  aiConfig: Record<string, unknown> | null;
  aiConfigError: string | null;
  frontendUrl: string;
  health: HealthResponse | null;
  healthError: string | null;
  isLoading: boolean;
  localStorageAvailable: boolean;
  tokenExists: boolean;
  user: User | null;
  userError: string | null;
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "Not available";

const AI_CONFIG_FIELDS = [
  { key: "llm_provider", label: "LLM provider", tone: "ai" },
  { key: "embedding_provider", label: "Embedding provider", tone: "info" },
  { key: "generation_model", label: "Generation model" },
  { key: "embedding_model", label: "Embedding model" },
  { key: "generation_temperature", label: "Temperature" },
  { key: "generation_max_tokens", label: "Max tokens" },
  { key: "enable_reranking", label: "Reranking enabled" },
  { key: "retrieval_candidates", label: "Retrieval candidates" },
  { key: "rerank_top_k", label: "Rerank top K" },
] as const;

const SENSITIVE_KEY_PARTS = [
  "api_key",
  "apikey",
  "secret",
  "token",
  "password",
  "database_url",
  "dsn",
  "credential",
];

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim() ? value : "Not available";
  }

  return "Not available";
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function checkLocalStorageAvailable() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const key = "__devpilot_storage_check__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function safeUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Not available";
  }

  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return "Configured";
  }
}

function ConfigRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-t border-line-subtle py-3 text-sm sm:grid-cols-3 sm:gap-4">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-fg sm:col-span-2">{value}</dd>
    </div>
  );
}

function RuntimeCard({
  description,
  label,
  status,
}: {
  description: string;
  label: string;
  status: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-sunken p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{label}</p>
          <p className="mt-1 text-xs leading-5 text-fg-subtle">{description}</p>
        </div>
        <StatusBadge status={status} tone={status === "ok" ? "success" : undefined} />
      </div>
    </div>
  );
}

export function SettingsContent() {
  const router = useRouter();
  const [state, setState] = useState<SettingsState>({
    aiConfig: null,
    aiConfigError: null,
    frontendUrl: "Not available",
    health: null,
    healthError: null,
    isLoading: true,
    localStorageAvailable: false,
    tokenExists: false,
    user: null,
    userError: null,
  });

  const tokenStatus = state.tokenExists
    ? state.user
      ? "Valid"
      : state.userError
        ? "Needs sign in"
        : "Stored"
    : "Missing";

  const aiConfigRows = useMemo(() => {
    const config = state.aiConfig;
    if (!config) {
      return [];
    }

    return AI_CONFIG_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      value: displayValue(config[field.key]),
    }));
  }, [state.aiConfig]);

  const ollamaBaseUrl = useMemo(() => {
    if (!state.aiConfig || isSensitiveKey("ollama_base_url")) {
      return "Not available";
    }

    return safeUrl(state.aiConfig.ollama_base_url);
  }, [state.aiConfig]);

  const loadSettings = useCallback(async () => {
    const token = getToken();

    if (!token) {
      removeToken();
      router.replace("/login");
      return;
    }

    setState((current) => ({
      ...current,
      aiConfigError: null,
      healthError: null,
      isLoading: true,
      tokenExists: Boolean(token),
      userError: null,
    }));

    const [userResult, healthResult, aiConfigResult] = await Promise.allSettled([
      apiGet<User>("/api/v1/auth/me", { token }),
      apiGet<HealthResponse>("/health", { token: null }),
      apiGet<Record<string, unknown>>("/api/v1/system/ai-config"),
    ]);

    if (userResult.status === "rejected") {
      if (
        userResult.reason instanceof ApiRequestError &&
        userResult.reason.status === 401
      ) {
        removeToken();
        router.replace("/login");
        return;
      }
    }

    setState({
      aiConfig: aiConfigResult.status === "fulfilled" ? aiConfigResult.value : null,
      aiConfigError:
        aiConfigResult.status === "rejected"
          ? requestErrorMessage(aiConfigResult.reason, "Failed to load AI configuration.")
          : null,
      frontendUrl:
        typeof window !== "undefined" ? window.location.origin : "Not available",
      health: healthResult.status === "fulfilled" ? healthResult.value : null,
      healthError:
        healthResult.status === "rejected"
          ? COMMON_ERROR_MESSAGES.backendUnreachable
          : null,
      isLoading: false,
      localStorageAvailable: checkLocalStorageAvailable(),
      tokenExists: Boolean(getToken()),
      user: userResult.status === "fulfilled" ? userResult.value : null,
      userError:
        userResult.status === "rejected"
          ? requestErrorMessage(userResult.reason, "Failed to load profile.")
          : null,
    });
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function handleLogout() {
    removeToken();
    router.replace("/login");
  }

  return (
    <div className="grid min-w-0 gap-6">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <Badge tone="ai">System Settings</Badge>
              <h1 className="mt-4 text-2xl font-semibold text-fg">
                DevPilot AI configuration
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">
                A safe, demo-ready view of account, model, runtime, and session
                settings. Secrets and raw tokens are never displayed.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void loadSettings()}
              isLoading={state.isLoading}
              variant="secondary"
            >
              {state.isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </section>

        {state.isLoading ? (
          <LoadingSkeleton label="Loading settings" rows={6} />
        ) : (
          <>
            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Profile"
                  description="Current account information from the authenticated session."
                />
                <ErrorState
                  action={
                    state.userError ? (
                      <Button type="button" variant="secondary" onClick={() => void loadSettings()}>
                        Retry
                      </Button>
                    ) : undefined
                  }
                  message={state.userError}
                  title="Profile unavailable"
                />
                {state.user ? (
                  <dl className="mt-2">
                    <ConfigRow label="Email" value={displayValue(state.user.email)} />
                    <ConfigRow label="Full name" value={displayValue(state.user.full_name)} />
                    <div className="grid gap-1 border-t border-line-subtle py-3 text-sm sm:grid-cols-3 sm:gap-4">
                      <dt className="text-fg-subtle">Role</dt>
                      <dd className="min-w-0 sm:col-span-2">
                        <RoleBadge role={state.user.role} />
                      </dd>
                    </div>
                    <div className="grid gap-1 border-t border-line-subtle py-3 text-sm sm:grid-cols-3 sm:gap-4">
                      <dt className="text-fg-subtle">Account status</dt>
                      <dd className="min-w-0 sm:col-span-2">
                        <StatusBadge
                          label={state.user.is_active ? "Active" : "Inactive"}
                          tone={state.user.is_active ? "success" : "critical"}
                        />
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </Card>

              <Card>
                <CardHeader
                  title="AI Configuration"
                  description="Runtime model and retrieval settings from /api/v1/system/ai-config."
                />
                <ErrorState
                  action={
                    state.aiConfigError ? (
                      <Button type="button" variant="secondary" onClick={() => void loadSettings()}>
                        Retry
                      </Button>
                    ) : undefined
                  }
                  message={state.aiConfigError}
                  title="AI config unavailable"
                />
                {state.aiConfig ? (
                  <div className="mt-2">
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <RuntimeCard
                        label="Generation"
                        description={displayValue(state.aiConfig.generation_model)}
                        status={displayValue(state.aiConfig.llm_provider)}
                      />
                      <RuntimeCard
                        label="Embeddings"
                        description={displayValue(state.aiConfig.embedding_model)}
                        status={displayValue(state.aiConfig.embedding_provider)}
                      />
                    </div>
                    <dl>
                      {aiConfigRows.map((row) => (
                        <ConfigRow key={row.key} label={row.label} value={row.value} />
                      ))}
                      {ollamaBaseUrl !== "Not available" ? (
                        <ConfigRow label="Ollama base URL" value={ollamaBaseUrl} />
                      ) : null}
                    </dl>
                    <p className="mt-4 rounded-md border border-line bg-sunken px-4 py-3 text-xs leading-5 text-fg-subtle">
                      Sensitive fields such as API keys, JWTs, secrets, passwords,
                      and database URLs are intentionally omitted.
                    </p>
                  </div>
                ) : null}
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Security"
                  description="Session status and local browser security context."
                />
                <dl>
                  <div className="grid gap-1 border-t border-line-subtle py-3 text-sm sm:grid-cols-3 sm:gap-4">
                    <dt className="text-fg-subtle">Token status</dt>
                    <dd className="min-w-0 sm:col-span-2">
                      <StatusBadge
                        label={tokenStatus}
                        tone={tokenStatus === "Valid" ? "success" : "warning"}
                      />
                    </dd>
                  </div>
                  <ConfigRow
                    label="Token value"
                    value={state.tokenExists ? "Hidden for security" : "Not stored"}
                  />
                  <ConfigRow
                    label="Local storage"
                    value={state.localStorageAvailable ? "Available" : "Unavailable"}
                  />
                </dl>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-sunken p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-fg-muted">
                    Your session token is stored locally by the browser and is
                    cleared when you log out. The token itself is not printed here.
                  </p>
                  <Button type="button" onClick={handleLogout} variant="secondary">
                    Logout
                  </Button>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Developer Info"
                  description="Non-sensitive runtime values useful during demos."
                />
                <ErrorState
                  action={
                    state.healthError ? (
                      <Button type="button" variant="secondary" onClick={() => void loadSettings()}>
                        Retry
                      </Button>
                    ) : undefined
                  }
                  message={state.healthError}
                  title="Backend status unavailable"
                />
                <dl>
                  <ConfigRow label="Backend URL" value={API_BASE_URL} />
                  <ConfigRow label="Frontend URL" value={state.frontendUrl} />
                  <ConfigRow
                    label="Environment"
                    value={displayValue(state.health?.environment)}
                  />
                  <ConfigRow
                    label="Backend status"
                    value={displayValue(state.health?.status)}
                  />
                  <ConfigRow
                    label="Service"
                    value={displayValue(state.health?.service ?? state.health?.app)}
                  />
                  <ConfigRow label="App version" value={APP_VERSION} />
                </dl>
              </Card>
            </div>
          </>
        )}
    </div>
  );
}
