type ProgressRingProps = {
  label?: string;
  size?: number;
  value: number;
};

export function ProgressRing({ label = "Progress", size = 120, value }: ProgressRingProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div className="relative inline-grid place-items-center" style={{ height: size, width: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke="#0f172a"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xl font-semibold text-fg">{Math.round(normalizedValue)}%</p>
        <p className="text-xs text-fg-subtle">{label}</p>
      </div>
    </div>
  );
}
