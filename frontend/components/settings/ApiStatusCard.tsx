import { LoadingState } from "@/components/LoadingState";
import {
  CardError,
  FieldRow,
  SettingsButton,
  SettingsCard,
  StatusBadge,
} from "@/components/settings/SettingsCard";
import { displayValue } from "@/components/settings/settingsUtils";
import type { HealthResponse } from "@/types";

type ApiStatusCardProps = {
  apiUrl: string;
  data: HealthResponse | null;
  error: string | null;
  isLoading: boolean;
  lastChecked: string | null;
  onRefresh: () => void;
};

export function ApiStatusCard({
  apiUrl,
  data,
  error,
  isLoading,
  lastChecked,
  onRefresh,
}: ApiStatusCardProps) {
  const status = data?.status ?? (error ? "failed" : "Not available");
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";
  const statusTone =
    normalizedStatus === "ok"
      ? "emerald"
      : normalizedStatus === "failed" || normalizedStatus === "error" || error
        ? "red"
        : "slate";

  return (
    <SettingsCard
      title="API Status"
      action={
        <SettingsButton type="button" disabled={isLoading} onClick={onRefresh}>
          {isLoading ? "Checking..." : "Refresh API Status"}
        </SettingsButton>
      }
    >
      <div className="grid gap-4">
        {isLoading && !data ? <LoadingState label="Checking backend" /> : null}
        {error ? (
          <CardError message="Backend unavailable. Check that backend is running on NEXT_PUBLIC_API_URL." />
        ) : null}

        <dl>
          <FieldRow
            label="Status"
            value={
              <StatusBadge tone={statusTone}>
                {displayValue(status)}
              </StatusBadge>
            }
          />
          <FieldRow
            label="Service"
            value={displayValue(data?.service ?? data?.app ?? "DevPilot AI API")}
          />
          <FieldRow label="Environment" value={displayValue(data?.environment)} />
          <FieldRow label="API URL" value={apiUrl} />
          <FieldRow label="Last checked" value={displayValue(lastChecked)} />
        </dl>
      </div>
    </SettingsCard>
  );
}
