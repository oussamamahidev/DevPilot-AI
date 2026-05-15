"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError, apiGet } from "@/lib/api";
import { getToken, removeToken } from "@/lib/auth";
import type { User } from "@/types";

type AuthUserState = {
  error: string | null;
  isLoading: boolean;
  user: User | null;
};

export function useAuthUser() {
  const router = useRouter();
  const [state, setState] = useState<AuthUserState>({
    error: null,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    let isMounted = true;
    const token = getToken();

    if (!token) {
      router.replace("/login");
      return () => {
        isMounted = false;
      };
    }

    async function loadUser() {
      try {
        const user = await apiGet<User>("/api/v1/auth/me", { token });

        if (isMounted) {
          setState({ error: null, isLoading: false, user });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to reach the backend. Check that the API is running.",
          isLoading: false,
          user: null,
        });
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return state;
}
