"use client";

import { useAuthUser } from "@/hooks/useAuthUser";

export function useAdminAccess() {
  const auth = useAuthUser();
  return {
    ...auth,
    isAdmin: auth.user?.role === "admin" || auth.user?.role === "super_admin",
    isSuperAdmin: auth.user?.role === "super_admin",
  };
}
