type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-fg-muted">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full bg-brand motion-safe:animate-pulse"
      />
      <span>{label}</span>
    </div>
  );
}
