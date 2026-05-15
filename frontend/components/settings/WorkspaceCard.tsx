import { LoadingState } from "@/components/LoadingState";
import {
  CardError,
  CardNote,
  FieldRow,
  SettingsButton,
  SettingsCard,
} from "@/components/settings/SettingsCard";
import {
  displayValue,
  formatDateTime,
  shortenId,
} from "@/components/settings/settingsUtils";
import type { Workspace } from "@/types";

type WorkspaceCardProps = {
  currentUserId: string | null;
  error: string | null;
  isCreatingDefault: boolean;
  isLoading: boolean;
  onCreateDefault: () => void;
  onRefresh: () => void;
  workspaces: Workspace[];
};

function getMemberRole(workspace: Workspace, currentUserId: string | null) {
  if (!currentUserId) {
    return null;
  }

  const member = workspace.members.find((item) => item.user_id === currentUserId);

  if (member?.role) {
    return member.role;
  }

  if (workspace.owner_id === currentUserId) {
    return "owner";
  }

  return null;
}

export function WorkspaceCard({
  currentUserId,
  error,
  isCreatingDefault,
  isLoading,
  onCreateDefault,
  onRefresh,
  workspaces,
}: WorkspaceCardProps) {
  const selectedWorkspace = workspaces[0] ?? null;
  const memberRole = selectedWorkspace
    ? getMemberRole(selectedWorkspace, currentUserId)
    : null;

  return (
    <SettingsCard
      title="Workspace"
      action={
        <SettingsButton type="button" disabled={isLoading} onClick={onRefresh}>
          {isLoading ? "Refreshing..." : "Refresh workspaces"}
        </SettingsButton>
      }
    >
      <div className="grid gap-4">
        {isLoading && !selectedWorkspace ? (
          <LoadingState label="Loading workspaces" />
        ) : null}
        {error ? <CardError message={error} /> : null}

        {selectedWorkspace ? (
          <>
            <CardNote>
              Showing the first workspace returned by the backend. Total workspaces:{" "}
              {workspaces.length}.
            </CardNote>
            <dl>
              <FieldRow label="Name" value={displayValue(selectedWorkspace.name)} />
              <FieldRow
                label="Description"
                value={displayValue(selectedWorkspace.description)}
              />
              <FieldRow label="Workspace ID" value={shortenId(selectedWorkspace.id)} />
              <FieldRow label="Owner ID" value={shortenId(selectedWorkspace.owner_id)} />
              <FieldRow
                label="Created"
                value={formatDateTime(selectedWorkspace.created_at)}
              />
              <FieldRow
                label="Updated"
                value={formatDateTime(selectedWorkspace.updated_at)}
              />
              <FieldRow label="Member role" value={displayValue(memberRole)} />
            </dl>
          </>
        ) : null}

        {!isLoading && !selectedWorkspace ? (
          <div className="grid gap-4">
            <CardNote>No workspace found.</CardNote>
            <div>
              <SettingsButton
                type="button"
                disabled={isCreatingDefault}
                onClick={onCreateDefault}
                variant="primary"
              >
                {isCreatingDefault ? "Creating..." : "Create default workspace"}
              </SettingsButton>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsCard>
  );
}
