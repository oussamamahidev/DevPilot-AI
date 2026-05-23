"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LOGIN_PATH } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { error, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !error) {
      router.replace(LOGIN_PATH);
    }
  }, [error, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton label="Checking session" rows={2} />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (error) {
      return (
        <div className="p-6">
          <ErrorState
            action={
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-9 rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-800"
              >
                Retry
              </button>
            }
            message={error}
            title="Unable to verify session"
          />
        </div>
      );
    }
    return null;
  }

  return children;
}
