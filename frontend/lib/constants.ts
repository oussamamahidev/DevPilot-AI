export const APP_NAME = "DevPilot AI";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const TOKEN_STORAGE_KEY = "devpilot_access_token";
export const LEGACY_TOKEN_STORAGE_KEY = "devpilot_token";
export const AUTH_TOKEN_CHANGED_EVENT = "devpilot_auth_token_changed";

export const LOGIN_PATH = "/login";
export const AUTHENTICATED_HOME_PATH = "/dashboard";

export const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/chat",
  "/dashboard",
  "/documents",
  "/settings",
  "/workspaces",
] as const;
