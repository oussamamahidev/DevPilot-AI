"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  ErrorState,
  LoadingSkeleton,
  RoleBadge,
  StatusBadge,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { API_BASE_URL, ApiConnectionError, ApiRequestError, apiGet } from "@/lib/api-client";
import { getToken, removeToken } from "@/lib/auth";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces";
import type { HealthResponse, User, Workspace } from "@/types";

type SettingsPreferences = {
  compactTables: boolean;
  defaultWorkspaceId: string;
  emailDigest: boolean;
  reducedMotion: boolean;
};

type SettingsState = {
  aiConfig: Record<string, unknown> | null;
  aiConfigError: string | null;
  frontendUrl: string;
  health: HealthResponse | null;
  healthError: string | null;
  isCreatingWorkspace: boolean;
  isLoading: boolean;
  localStorageAvailable: boolean;
  preferences: SettingsPreferences;
  tokenExists: boolean;
  user: User | null;
  userError: string | null;
  workspaceError: string | null;
  workspaces: Workspace[];
};

type SectionTone = "ai" | "critical" | "info" | "neutral" | "success" | "warning";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "Not available";
const PREFERENCES_STORAGE_KEY = "devpilot.settings.preferences";

const DEFAULT_PREFERENCES: SettingsPreferences = {
  compactTables: true,
  defaultWorkspaceId: "",
  emailDigest: true,
  reducedMotion: false,
};

const AI_CONFIG_FIELDS = [
  { key: "generation_model", label: "Generation model" },
  { key: "embedding_model", label: "Embedding model" },
  { key: "generation_temperature", label: "Temperature" },
  { key: "generation_max_tokens", label: "Max tokens" },
  { key: "enable_reranking", label: "Reranking" },
  { key: "retrieval_candidates", label: "Retrieval candidates" },
  { key: "rerank_top_k", label: "Rerank top K" },
] as const;

const SETTINGS_NAV: Array<{
  description: string;
  href: string;
  icon: IconName;
  label: string;
}> = [
  {
    description: "Identity, role, and account status",
    href: "#profile",
    icon: "user",
    label: "Profile",
  },
  {
    description: "Session posture and browser storage",
    href: "#security",
    icon: "shield",
    label: "Security",
  },
  {
    description: "Provider credentials and runtime models",
    href: "#api-keys",
    icon: "lock",
    label: "API Keys",
  },
  {
    description: "Console behavior for this browser",
    href: "#preferences",
    icon: "settings",
    label: "Preferences",
  },
  {
    description: "Workspace ownership and defaults",
    href: "#workspace-settings",
    icon: "folder",
    label: "Workspace Settings",
  },
];

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

function loadPreferences() {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(stored) as Partial<SettingsPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function persistPreferences(preferences: SettingsPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.dataset.devpilotCompactTables = preferences.compactTables
      ? "true"
      : "false";
    document.documentElement.dataset.devpilotReducedMotion = preferences.reducedMotion
      ? "true"
      : "false";
  } catch {
    // Preferences are convenience settings, so failures should not block the page.
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortenId(value: string | null | undefined, visibleCharacters = 8) {
  if (!value) {
    return "Not available";
  }

  if (value.length <= visibleCharacters) {
    return value;
  }

  return `${value.slice(0, visibleCharacters)}...`;
}

function initialsFor(user: User | null) {
  const source = user?.full_name?.trim() || user?.email?.trim() || "DevPilot";
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "DP";
}

function getMemberRole(workspace: Workspace, currentUserId: string | null) {
  if (!currentUserId) {
    return null;
  }

  const member = workspace.members.find((item) => item.user_id === currentUserId);

  if (member?.role) {
    return member.role;
  }

  if (workspace.owner_id === currentUserId) {
    return "owner";
  }

  return null;
}

function providerValue(config: Record<string, unknown> | null, key: string) {
  const value = config?.[key];
  return typeof value === "string" && value.trim() ? value : "Not available";
}

function providerIsActive(config: Record<string, unknown> | null, provider: string) {
  return (
    providerValue(config, "llm_provider").toLowerCase() === provider ||
    providerValue(config, "embedding_provider").toLowerCase() === provider
  );
}

function OverviewStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: SectionTone;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <div className="mt-2 min-w-0 text-sm font-semibold text-fg">
        {typeof value === "string" ? <Badge tone={tone ?? "neutral"}>{value}</Badge> : value}
      </div>
    </div>
  );
}

function SectionCard({
  action,
  children,
  description,
  icon,
  id,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  icon: IconName;
  id: string;
  title: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface shadow-sm"
    >
      <div className="border-b border-line bg-sunken/60 p-5">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-brand-subtle-line bg-brand-subtle text-brand-fg">
              <Icon name={icon} size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold text-fg">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-fg-muted">{description}</p>
            </div>
          </div>
          {action ? (
            <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:shrink-0">
              {action}
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-sunken px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <div className="mt-2 min-w-0 break-words text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}

function ConfigItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="min-w-0 break-words text-sm font-semibold text-fg">{value}</span>
    </div>
  );
}

function CredentialCard({
  description,
  icon,
  label,
  status,
  tone,
}: {
  description: string;
  icon: IconName;
  label: string;
  status: string;
  tone: SectionTone;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-sunken p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-surface text-fg-muted">
          <Icon name={icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-fg">{label}</p>
            <Badge tone={tone}>{status}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-fg-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-sunken p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-fg">{label}</p>
        <p className="mt-1 text-sm leading-6 text-fg-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
          checked
            ? "border-brand bg-brand"
            : "border-line-strong bg-surface"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function WorkspaceCard({
  currentUserId,
  isDefault,
  workspace,
}: {
  currentUserId: string | null;
  isDefault: boolean;
  workspace: Workspace;
}) {
  const role = getMemberRole(workspace, currentUserId);
  const isOwner = workspace.owner_id === currentUserId;

  return (
    <article className="min-w-0 rounded-lg border border-line bg-sunken p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-sm font-semibold text-fg">
              {displayValue(workspace.name)}
            </h3>
            {isDefault ? <Badge tone="ai">Default</Badge> : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-fg-muted">
            {displayValue(workspace.description)}
          </p>
        </div>
        <StatusBadge label={isOwner ? "Owner" : role ?? "Member"} tone={isOwner ? "success" : "info"} />
      </div>

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        <DetailTile label="Members" value={workspace.members.length} />
        <DetailTile label="Workspace ID" value={shortenId(workspace.id)} />
        <DetailTile label="Created" value={formatDateTime(workspace.created_at)} />
        <DetailTile label="Updated" value={formatDateTime(workspace.updated_at)} />
      </div>
    </article>
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
    isCreatingWorkspace: false,
    isLoading: true,
    localStorageAvailable: false,
    preferences: DEFAULT_PREFERENCES,
    tokenExists: false,
    user: null,
    userError: null,
    workspaceError: null,
    workspaces: [],
  });

  const tokenStatus = state.tokenExists
    ? state.user
      ? "Valid"
      : state.userError
        ? "Needs sign in"
        : "Stored"
    : "Missing";

  const defaultWorkspace = useMemo(() => {
    if (!state.workspaces.length) {
      return null;
    }

    return (
      state.workspaces.find(
        (workspace) => workspace.id === state.preferences.defaultWorkspaceId,
      ) ?? state.workspaces[0]
    );
  }, [state.preferences.defaultWorkspaceId, state.workspaces]);

  const ownedWorkspaceCount = useMemo(
    () =>
      state.workspaces.filter((workspace) => workspace.owner_id === state.user?.id)
        .length,
    [state.user?.id, state.workspaces],
  );

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
      workspaceError: null,
    }));

    const [userResult, healthResult, aiConfigResult, workspaceResult] =
      await Promise.allSettled([
        apiGet<User>("/api/v1/auth/me", { token }),
        apiGet<HealthResponse>("/health", { token: null }),
        apiGet<Record<string, unknown>>("/api/v1/system/ai-config"),
        listWorkspaces(),
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

    const preferences = loadPreferences();
    const workspaces =
      workspaceResult.status === "fulfilled" ? workspaceResult.value : [];
    const storedDefaultWorkspaceExists = workspaces.some(
      (workspace) => workspace.id === preferences.defaultWorkspaceId,
    );
    const defaultWorkspaceId = storedDefaultWorkspaceExists
      ? preferences.defaultWorkspaceId
      : workspaces[0]?.id || DEFAULT_PREFERENCES.defaultWorkspaceId;

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
      isCreatingWorkspace: false,
      isLoading: false,
      localStorageAvailable: checkLocalStorageAvailable(),
      preferences: {
        ...preferences,
        defaultWorkspaceId,
      },
      tokenExists: Boolean(getToken()),
      user: userResult.status === "fulfilled" ? userResult.value : null,
      userError:
        userResult.status === "rejected"
          ? requestErrorMessage(userResult.reason, "Failed to load profile.")
          : null,
      workspaceError:
        workspaceResult.status === "rejected"
          ? requestErrorMessage(workspaceResult.reason, "Failed to load workspaces.")
          : null,
      workspaces,
    });
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (state.isLoading) {
      return;
    }

    persistPreferences(state.preferences);
  }, [state.isLoading, state.preferences]);

  function handleLogout() {
    removeToken();
    router.replace("/login");
  }

  function updatePreference<Key extends keyof SettingsPreferences>(
    key: Key,
    value: SettingsPreferences[Key],
  ) {
    setState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }

  async function handleCreateDefaultWorkspace() {
    setState((current) => ({
      ...current,
      isCreatingWorkspace: true,
      workspaceError: null,
    }));

    try {
      const workspace = await createWorkspace({
        description: "Primary workspace for DevPilot AI operations.",
        name: "Default workspace",
      });

      setState((current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          defaultWorkspaceId: workspace.id,
        },
      }));
      await loadSettings();
    } catch (error) {
      setState((current) => ({
        ...current,
        isCreatingWorkspace: false,
        workspaceError: requestErrorMessage(error, "Failed to create default workspace."),
      }));
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl min-w-0 gap-6">
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line bg-gradient-to-br from-sunken via-surface to-brand-subtle/40 p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Badge tone="ai">Enterprise Settings</Badge>
              <h1 className="mt-4 break-words text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                DevPilot AI control settings
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">
                Account identity, credential posture, local console behavior, and
                workspace defaults are organized into clear operational sections.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void loadSettings()}
              isLoading={state.isLoading}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <Icon name="refreshCw" size={16} />
              {state.isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStat
            label="Account"
            tone={state.user?.is_active ? "success" : "warning"}
            value={state.user?.is_active ? "Active" : "Needs review"}
          />
          <OverviewStat
            label="Session"
            tone={tokenStatus === "Valid" ? "success" : "warning"}
            value={tokenStatus}
          />
          <OverviewStat
            label="Workspaces"
            value={`${state.workspaces.length} available`}
          />
          <OverviewStat
            label="Backend"
            tone={state.health?.status === "ok" ? "success" : "warning"}
            value={displayValue(state.health?.status)}
          />
        </div>
      </section>

      <nav aria-label="Settings sections" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {SETTINGS_NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="group flex min-w-0 gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm transition hover:border-line-strong hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-sunken text-fg-muted transition group-hover:text-fg">
              <Icon name={item.icon} size={17} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-fg">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-fg-muted">{item.description}</span>
            </span>
          </a>
        ))}
      </nav>

      {state.isLoading ? (
        <LoadingSkeleton label="Loading settings" rows={5} variant="card" />
      ) : (
        <div className="grid min-w-0 gap-6">
          <SectionCard
            id="profile"
            icon="user"
            title="Profile"
            description="Authenticated user context and account-level access."
            action={
              state.userError ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void loadSettings()}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            <ErrorState message={state.userError} title="Profile unavailable" />

            {state.user ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="min-w-0 rounded-xl border border-line bg-sunken p-5">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand text-base font-semibold text-white">
                      {initialsFor(state.user)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-semibold text-fg">
                        {displayValue(state.user.full_name)}
                      </h3>
                      <p className="mt-1 break-all text-sm text-fg-muted">
                        {displayValue(state.user.email)}
                      </p>
                      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                        <RoleBadge role={state.user.role} />
                        <StatusBadge
                          label={state.user.is_active ? "Active" : "Inactive"}
                          tone={state.user.is_active ? "success" : "critical"}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <DetailTile label="User ID" value={shortenId(state.user.id)} />
                  <DetailTile label="Role" value={<RoleBadge role={state.user.role} />} />
                  <DetailTile
                    label="Account status"
                    value={
                      <StatusBadge
                        label={state.user.is_active ? "Active" : "Inactive"}
                        tone={state.user.is_active ? "success" : "critical"}
                      />
                    }
                  />
                  <DetailTile
                    label="Default workspace"
                    value={displayValue(defaultWorkspace?.name)}
                  />
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            id="security"
            icon="shield"
            title="Security"
            description="Session visibility, token safety, and browser storage status."
          >
            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
              <DetailTile
                label="Token status"
                value={
                  <StatusBadge
                    label={tokenStatus}
                    tone={tokenStatus === "Valid" ? "success" : "warning"}
                  />
                }
              />
              <DetailTile
                label="Token value"
                value={state.tokenExists ? "Hidden for security" : "Not stored"}
              />
              <DetailTile
                label="Local storage"
                value={state.localStorageAvailable ? "Available" : "Unavailable"}
              />
            </div>

            <div className="mt-5 flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-sunken p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">Session controls</p>
                <p className="mt-1 text-sm leading-6 text-fg-muted">
                  Signing out clears the stored browser token and returns you to
                  authentication.
                </p>
              </div>
              <Button type="button" onClick={handleLogout} variant="secondary" className="w-full md:w-auto">
                <Icon name="logout" size={16} />
                Logout
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            id="api-keys"
            icon="lock"
            title="API Keys"
            description="Credential posture for AI providers and the non-sensitive runtime configuration exposed to the console."
            action={
              state.aiConfigError ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void loadSettings()}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            <ErrorState message={state.aiConfigError} title="AI configuration unavailable" />

            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <div className="grid min-w-0 gap-3">
                <CredentialCard
                  icon="sparkles"
                  label="LLM provider"
                  status={displayValue(state.aiConfig?.llm_provider)}
                  tone="ai"
                  description={`Generation requests route through ${displayValue(
                    state.aiConfig?.generation_model,
                  )}.`}
                />
                <CredentialCard
                  icon="box"
                  label="Embedding provider"
                  status={displayValue(state.aiConfig?.embedding_provider)}
                  tone="info"
                  description={`Embedding jobs use ${displayValue(
                    state.aiConfig?.embedding_model,
                  )}.`}
                />
                <CredentialCard
                  icon="eyeOff"
                  label="Secrets exposed to browser"
                  status="0"
                  tone="success"
                  description="Credential values, tokens, passwords, and database URLs are never rendered in the client."
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="border-b border-line p-4">
                  <h3 className="text-sm font-semibold text-fg">Provider credentials</h3>
                  <p className="mt-1 text-sm leading-6 text-fg-muted">
                    Status is based on the active backend provider configuration.
                  </p>
                </div>
                <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2">
                  <CredentialCard
                    icon="server"
                    label="Ollama endpoint"
                    status={providerIsActive(state.aiConfig, "ollama") ? "Active" : "Not active"}
                    tone={providerIsActive(state.aiConfig, "ollama") ? "success" : "neutral"}
                    description="Local model access is resolved by the backend runtime."
                  />
                  <CredentialCard
                    icon="sparkles"
                    label="Gemini API key"
                    status={providerIsActive(state.aiConfig, "gemini") ? "Server managed" : "Not active"}
                    tone={providerIsActive(state.aiConfig, "gemini") ? "success" : "neutral"}
                    description="Gemini credentials remain in backend environment configuration."
                  />
                  <CredentialCard
                    icon="cloudUpload"
                    label="OpenAI API key"
                    status={providerIsActive(state.aiConfig, "openai") ? "Server managed" : "Not active"}
                    tone={providerIsActive(state.aiConfig, "openai") ? "success" : "neutral"}
                    description="OpenAI credentials remain in backend environment configuration."
                  />
                  <CredentialCard
                    icon="database"
                    label="Application database"
                    status="Hidden"
                    tone="success"
                    description="Database URLs and connection secrets are intentionally omitted."
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {aiConfigRows.map((row) => (
                <ConfigItem key={row.key} label={row.label} value={row.value} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            id="preferences"
            icon="settings"
            title="Preferences"
            description="Console preferences saved locally for this browser."
          >
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="grid min-w-0 gap-4">
                <label className="grid min-w-0 gap-2 text-sm font-medium text-fg">
                  <span>Default workspace</span>
                  <select
                    value={state.preferences.defaultWorkspaceId}
                    onChange={(event) =>
                      updatePreference("defaultWorkspaceId", event.target.value)
                    }
                    className="h-10 min-w-0 rounded-md border border-line bg-surface px-3 text-sm text-fg outline-none transition focus:border-line-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
                  >
                    {state.workspaces.length ? (
                      state.workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No workspace available</option>
                    )}
                  </select>
                </label>

                <DetailTile label="Preference storage" value="Saved locally" />
                <DetailTile label="Frontend URL" value={state.frontendUrl} />
                <DetailTile label="App version" value={APP_VERSION} />
              </div>

              <div className="grid min-w-0 gap-3">
                <ToggleRow
                  checked={state.preferences.emailDigest}
                  label="Operational digest"
                  description="Receive concise workspace and ingestion status summaries when notification services are configured."
                  onChange={(value) => updatePreference("emailDigest", value)}
                />
                <ToggleRow
                  checked={state.preferences.compactTables}
                  label="Compact admin tables"
                  description="Prefer denser table spacing for data-heavy admin workflows."
                  onChange={(value) => updatePreference("compactTables", value)}
                />
                <ToggleRow
                  checked={state.preferences.reducedMotion}
                  label="Reduced motion"
                  description="Reduce decorative transitions in the console when supported by the interface."
                  onChange={(value) => updatePreference("reducedMotion", value)}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="workspace-settings"
            icon="folder"
            title="Workspace Settings"
            description="Workspace access, ownership, and default workspace selection."
            action={
              <Link
                href="/workspaces"
                className="inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <Icon name="arrowRight" size={16} />
                Open workspaces
              </Link>
            }
          >
            <ErrorState
              action={
                state.workspaceError ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void loadSettings()}>
                    Retry
                  </Button>
                ) : undefined
              }
              message={state.workspaceError}
              title="Workspaces unavailable"
            />

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailTile label="Total workspaces" value={state.workspaces.length} />
              <DetailTile label="Owned by you" value={ownedWorkspaceCount} />
              <DetailTile
                label="Default workspace"
                value={displayValue(defaultWorkspace?.name)}
              />
              <DetailTile
                label="Backend service"
                value={displayValue(state.health?.service ?? state.health?.app)}
              />
            </div>

            {state.workspaces.length ? (
              <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
                {state.workspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.id}
                    currentUserId={state.user?.id ?? null}
                    isDefault={workspace.id === defaultWorkspace?.id}
                    workspace={workspace}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-line bg-sunken p-6 text-center">
                <Icon name="folder" size={28} className="mx-auto text-fg-subtle" />
                <h3 className="mt-3 text-base font-semibold text-fg">No workspace found</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-fg-muted">
                  Create a default workspace to keep documents, chats, and RAG
                  evaluations organized.
                </p>
                <Button
                  type="button"
                  onClick={() => void handleCreateDefaultWorkspace()}
                  isLoading={state.isCreatingWorkspace}
                  className="mt-4"
                >
                  <Icon name="plus" size={16} />
                  {state.isCreatingWorkspace ? "Creating..." : "Create default workspace"}
                </Button>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-line bg-sunken p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Icon name="server" size={18} className="mt-0.5 text-fg-subtle" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">Runtime endpoints</p>
                  <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                    <ConfigItem label="Backend URL" value={API_BASE_URL} />
                    <ConfigItem label="Environment" value={displayValue(state.health?.environment)} />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
