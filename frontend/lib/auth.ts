import {
  AUTH_TOKEN_CHANGED_EVENT,
  LEGACY_TOKEN_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "@/lib/constants";

export { AUTH_TOKEN_CHANGED_EVENT, TOKEN_STORAGE_KEY };

function dispatchAuthTokenChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function saveToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  dispatchAuthTokenChanged();
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
  dispatchAuthTokenChanged();
}

export function isAuthenticated() {
  return Boolean(getToken());
}
