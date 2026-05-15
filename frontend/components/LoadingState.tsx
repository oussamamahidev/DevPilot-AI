type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
      <span>{label}</span>
    </div>
  );
}
