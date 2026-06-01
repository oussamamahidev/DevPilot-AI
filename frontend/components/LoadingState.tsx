import { LoadingState as UILoadingState } from "@/components/ui/LoadingState";

type LoadingStateProps = {
  label?: string;
};

/**
 * @deprecated Import from `@/components/ui` instead. This thin shim maps to the
 * unified `LoadingState` (inline variant) and will be removed once call sites
 * migrate — see MIGRATION.md.
 */
export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return <UILoadingState variant="inline" label={label} />;
}
