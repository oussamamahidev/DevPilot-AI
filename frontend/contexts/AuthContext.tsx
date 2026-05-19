"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiRequestError, apiGet, apiPost } from "@/lib/api";
import {
  AUTH_TOKEN_CHANGED_EVENT,
  TOKEN_STORAGE_KEY,
  getToken,
  removeToken,
  saveToken,
} from "@/lib/auth";
import type { TokenResponse, User } from "@/types";

type LoginInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  error: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to verify authentication. Check that the API is running.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const clearAuth = useCallback(() => {
    removeToken();
    setUser(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setUser(null);
      setError(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentUser = await apiGet<User>("/api/v1/auth/me", { token });
      setUser(currentUser);
      setError(null);
      return currentUser;
    } catch (requestError) {
      if (
        requestError instanceof ApiRequestError &&
        (requestError.status === 401 || requestError.status === 403)
      ) {
        removeToken();
        setUser(null);
        setError(null);
        return null;
      }

      setUser(null);
      setError(getAuthErrorMessage(requestError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiPost<TokenResponse>("/api/v1/auth/login", input, {
          token: null,
        });
        saveToken(response.access_token);
        const currentUser = await refreshUser();

        if (!currentUser) {
          throw new Error("Unable to load the authenticated user.");
        }

        return currentUser;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshUser],
  );

  const logout = useCallback(() => {
    clearAuth();
    router.replace("/login");
  }, [clearAuth, router]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    function syncFromStorage(event?: StorageEvent) {
      if (event && event.key !== TOKEN_STORAGE_KEY) {
        return;
      }

      if (!getToken()) {
        setUser(null);
        setError(null);
        setIsLoading(false);

        if (
          pathname?.startsWith("/dashboard") ||
          pathname?.startsWith("/documents") ||
          pathname?.startsWith("/chat") ||
          pathname?.startsWith("/settings") ||
          pathname?.startsWith("/admin")
        ) {
          router.replace("/login");
        }

        return;
      }

      void refreshUser();
    }

    function syncFromLocalEvent() {
      syncFromStorage();
    }

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, syncFromLocalEvent);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, syncFromLocalEvent);
    };
  }, [pathname, refreshUser, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      refreshUser,
      user,
    }),
    [error, isLoading, login, logout, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
