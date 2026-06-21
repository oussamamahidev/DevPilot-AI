import { LoadingState } from "@/components/LoadingState";
import {
  CardError,
  FieldRow,
  SettingsButton,
  SettingsCard,
  StatusBadge,
} from "@/components/settings/SettingsCard";
import { displayValue, shortenId } from "@/components/settings/settingsUtils";
import type { User } from "@/types";

type UserCardProps = {
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  user: User | null;
};

export function UserCard({ error, isLoading, onRefresh, user }: UserCardProps) {
  return (
    <SettingsCard
      title="Current User"
      action={
        <SettingsButton type="button" disabled={isLoading} onClick={onRefresh}>
          {isLoading ? "Refreshing..." : "Refresh user"}
        </SettingsButton>
      }
    >
      <div className="grid gap-4">
        {isLoading && !user ? <LoadingState label="Loading user" /> : null}
        {error ? <CardError message={error} /> : null}

        {user ? (
          <dl>
            <FieldRow label="Name" value={displayValue(user.full_name)} />
            <FieldRow label="Email" value={displayValue(user.email)} />
            <FieldRow label="Role" value={displayValue(user.role)} />
            <FieldRow
              label="Status"
              value={
                <StatusBadge tone={user.is_active ? "emerald" : "red"}>
                  {user.is_active ? "Active" : "Inactive"}
                </StatusBadge>
              }
            />
            <FieldRow label="User ID" value={shortenId(user.id)} />
          </dl>
        ) : null}

        {!isLoading && !user && !error ? (
          <p className="text-sm text-fg-muted">Not available</p>
        ) : null}
      </div>
    </SettingsCard>
  );
}
