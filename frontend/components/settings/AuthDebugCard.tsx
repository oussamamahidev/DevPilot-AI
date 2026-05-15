import {
  CardNote,
  SettingsButton,
  SettingsCard,
  StatusBadge,
} from "@/components/settings/SettingsCard";

type TokenValidationStatus = "idle" | "valid" | "invalid";

type AuthDebugCardProps = {
  copyStatus: string | null;
  isValidating: boolean;
  onClearToken: () => void;
  onCopyDiagnostic: () => void;
  onValidateToken: () => void;
  validationStatus: TokenValidationStatus;
};

export function AuthDebugCard({
  copyStatus,
  isValidating,
  onClearToken,
  onCopyDiagnostic,
  onValidateToken,
  validationStatus,
}: AuthDebugCardProps) {
  return (
    <SettingsCard title="Auth Debug">
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <SettingsButton
            type="button"
            disabled={isValidating}
            onClick={onValidateToken}
            variant="primary"
          >
            {isValidating ? "Validating..." : "Validate token"}
          </SettingsButton>
          <SettingsButton type="button" onClick={onClearToken}>
            Clear local token
          </SettingsButton>
          <SettingsButton type="button" onClick={onCopyDiagnostic}>
            Copy diagnostic summary
          </SettingsButton>
        </div>

        {validationStatus !== "idle" ? (
          <div>
            <StatusBadge tone={validationStatus === "valid" ? "emerald" : "red"}>
              {validationStatus === "valid" ? "Token valid" : "Token invalid"}
            </StatusBadge>
          </div>
        ) : null}

        {copyStatus ? <CardNote>{copyStatus}</CardNote> : null}
      </div>
    </SettingsCard>
  );
}
