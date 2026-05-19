"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useAuthUser() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.replace("/login");
    }
  }, [auth.isLoading, auth.user, router]);

  return {
    error: auth.error,
    isLoading: auth.isLoading,
    user: auth.user,
  };
}
