type LoadingSkeletonProps = {
  label?: string;
  rows?: number;
};

export function LoadingSkeleton({ label = "Loading", rows = 3 }: LoadingSkeletonProps) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-md border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}
