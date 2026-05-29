"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { SettingsContent } from "@/components/settings/SettingsContent";

export default function SettingsPage() {
  return (
    <DashboardShell
      activeItem="settings"
      title="Settings"
      description="Profile, AI runtime configuration, security, and developer information."
    >
      <SettingsContent />
    </DashboardShell>
  );
}
