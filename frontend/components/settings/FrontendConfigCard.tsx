import {
  FieldRow,
  SettingsCard,
  StatusBadge,
} from "@/components/settings/SettingsCard";
import { displayValue } from "@/components/settings/settingsUtils";

type FrontendConfigCardProps = {
  apiUrl: string;
  currentRoute: string;
  frontendOrigin: string;
  localStorageAvailable: boolean;
  tokenExists: boolean;
  tokenKey: string;
};

export function FrontendConfigCard({
  apiUrl,
  currentRoute,
  frontendOrigin,
  localStorageAvailable,
  tokenExists,
  tokenKey,
}: FrontendConfigCardProps) {
  return (
    <SettingsCard title="Frontend Runtime">
      <dl>
        <FieldRow label="API URL" value={apiUrl} />
        <FieldRow label="Frontend origin" value={displayValue(frontendOrigin)} />
        <FieldRow label="Current route" value={displayValue(currentRoute)} />
        <FieldRow
          label="Token stored"
          value={
            <StatusBadge tone={tokenExists ? "emerald" : "red"}>
              {tokenExists ? "Yes" : "No"}
            </StatusBadge>
          }
        />
        <FieldRow label="Token key" value={tokenKey} />
        <FieldRow label="Token value" value="Hidden for security" />
        <FieldRow
          label="LocalStorage available"
          value={localStorageAvailable ? "Yes" : "No"}
        />
      </dl>
    </SettingsCard>
  );
}
