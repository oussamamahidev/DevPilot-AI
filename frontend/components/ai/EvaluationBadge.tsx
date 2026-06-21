import { StatusBadge } from "@/components/ui/StatusBadge";

type EvaluationBadgeProps = {
  inverted?: boolean;
  label: string;
  value: number;
};

export function EvaluationBadge({ inverted = false, label, value }: EvaluationBadgeProps) {
  const tone = inverted
    ? value <= 0.3
      ? "success"
      : value <= 0.6
        ? "warning"
        : "critical"
    : value >= 0.75
      ? "success"
      : value >= 0.5
        ? "warning"
        : "critical";

  return <StatusBadge label={`${label} ${value.toFixed(2)}`} tone={tone} />;
}
