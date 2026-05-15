export const TOKEN_STORAGE_KEY = "devpilot_access_token";
const LEGACY_TOKEN_STORAGE_KEY = "devpilot_token";

export function saveToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function removeToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}
