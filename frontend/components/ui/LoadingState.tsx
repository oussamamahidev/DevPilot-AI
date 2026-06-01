import { Icon } from "@/components/ui/Icon";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

type LoadingVariant = "spinner" | "inline" | "skeleton" | "overlay";
type SkeletonVariant = "block" | "text" | "card" | "metric";

type LoadingStateProps = {
  label?: string;
  variant?: LoadingVariant;
  /** Skeleton-only: number of placeholder rows. */
  rows?: number;
  /** Skeleton-only: which skeleton shape to render. */
  skeletonVariant?: SkeletonVariant;
  className?: string;
};

function Spinner({ size = 18 }: { size?: number }) {
  return <Icon name="loader" size={size} className="motion-safe:animate-spin text-brand" aria-hidden="true" />;
}

/**
 * Unified loading affordance — the single entry point for all loading UI.
 *
 * - `spinner`  (default): centered spinner + label, for section/page loads.
 * - `inline`:   compact row spinner + label, for buttons/list rows.
 * - `skeleton`: content-shaped placeholders (delegates to LoadingSkeleton).
 * - `overlay`:  absolutely-positioned scrim for refreshing an existing panel
 *               (parent must be `relative`).
 */
export function LoadingState({
  label = "Loading",
  variant = "spinner",
  rows = 3,
  skeletonVariant = "block",
  className = "",
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return <LoadingSkeleton label={label} rows={rows} variant={skeletonVariant} />;
  }

  if (variant === "inline") {
    return (
      <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-sm text-fg-muted ${className}`}>
        <Spinner size={16} />
        <span>{label}</span>
      </span>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`absolute inset-0 z-10 grid place-items-center bg-surface/70 backdrop-blur-sm ${className}`}
      >
        <div className="flex flex-col items-center gap-2 text-sm text-fg-muted">
          <Spinner size={22} />
          <span>{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-10 text-sm text-fg-muted ${className}`}
    >
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  );
}
