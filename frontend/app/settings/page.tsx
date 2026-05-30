"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { SettingsContent } from "@/components/settings/SettingsContent";

export default function SettingsPage() {
  return (
    <DashboardShell
      activeItem="settings"
      title="Settings"
      description="Enterprise profile, security, API key, preference, and workspace controls."
    >
      <SettingsContent />
    </DashboardShell>
  );
}
