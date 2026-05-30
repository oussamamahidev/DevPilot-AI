type SkeletonVariant = "block" | "text" | "card" | "metric";

type LoadingSkeletonProps = {
  label?: string;
  rows?: number;
  variant?: SkeletonVariant;
};

const variantClasses: Record<SkeletonVariant, string> = {
  block: "h-20",
  card: "h-32",
  metric: "h-24",
  text: "h-4",
};

export function LoadingSkeleton({ label = "Loading", rows = 3, variant = "block" }: LoadingSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" aria-label={label} className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-lg border border-line bg-sunken ${variantClasses[variant]}`}
        />
      ))}
    </div>
  );
}
