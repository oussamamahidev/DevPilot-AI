"use client";

import { canAccessAdmin, isSuperAdminRole } from "@/lib/permissions";
import { useAuthUser } from "@/hooks/useAuthUser";

export function useAdminAccess() {
  const auth = useAuthUser();
  return {
    ...auth,
    isAdmin: canAccessAdmin(auth.user),
    isSuperAdmin: isSuperAdminRole(auth.user?.role),
  };
}
