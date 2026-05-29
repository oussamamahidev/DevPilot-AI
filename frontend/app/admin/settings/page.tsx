"use client";

import {
  AdminAccessMessage,
  AdminShell,
} from "@/components/admin/AdminUI";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { useAdminAccess } from "@/hooks/useAdminAccess";

export default function AdminSettingsPage() {
  const { isAdmin, isLoading } = useAdminAccess();

  if (isLoading) {
    return <AdminAccessMessage title="Settings" label="Checking admin access." />;
  }

  if (!isAdmin) {
    return <AdminAccessMessage title="Settings" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="Settings"
      description="Profile, AI runtime configuration, security, and developer information."
    >
      <SettingsContent />
    </AdminShell>
  );
}
