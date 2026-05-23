"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LOGIN_PATH } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

export function useAuthUser() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.user && !auth.error) {
      router.replace(LOGIN_PATH);
    }
  }, [auth.error, auth.isLoading, auth.user, router]);

  return {
    error: auth.error,
    isLoading: auth.isLoading,
    user: auth.user,
  };
}
