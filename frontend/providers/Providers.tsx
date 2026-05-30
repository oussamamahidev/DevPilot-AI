"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { WorkspaceProvider } from "@/providers/WorkspaceProvider";
import { NotificationsProvider } from "@/providers/NotificationsProvider";
import { CommandMenuProvider } from "@/providers/CommandMenuProvider";

/**
 * Global client providers. Order matters: Theme (no deps) → Auth → Workspace
 * (needs auth) → Notifications → CommandMenu (renders the ⌘K palette, which
 * consumes all of the above).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <NotificationsProvider>
              <CommandMenuProvider>{children}</CommandMenuProvider>
            </NotificationsProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
