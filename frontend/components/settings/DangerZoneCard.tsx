import {
  SettingsButton,
  SettingsCard,
} from "@/components/settings/SettingsCard";

type DangerZoneCardProps = {
  className?: string;
  onLogout: () => void;
};

export function DangerZoneCard({ className, onLogout }: DangerZoneCardProps) {
  return (
    <SettingsCard
      className={className}
      title="Danger Zone"
      description="Logout will remove your local access token from this browser."
      tone="danger"
    >
      <SettingsButton type="button" onClick={onLogout} variant="danger">
        Logout
      </SettingsButton>
    </SettingsCard>
  );
}
