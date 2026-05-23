"use client";

import type { ReactNode } from "react";
import { canAccessAdmin } from "@/lib/permissions";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

type AdminRouteProps = {
  children: ReactNode;
};

export function AdminRoute({ children }: AdminRouteProps) {
  const { isLoading, user } = useAuth();

  return (
    <ProtectedRoute>
      {isLoading ? (
        <LoadingSkeleton label="Checking admin access" rows={2} />
      ) : canAccessAdmin(user) ? (
        children
      ) : (
        <EmptyState
          description="Administrative tools are restricted to admin and super admin accounts."
          title="You do not have permission to access this page."
        />
      )}
    </ProtectedRoute>
  );
}
