import { Card } from "@/components/ui/Card";

type MetricCardProps = {
  detail?: string;
  label: string;
  value: string;
};

export function MetricCard({ detail, label, value }: MetricCardProps) {
  return (
    <Card>
      <p className="text-sm font-medium text-fg-subtle">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-fg-muted">{detail}</p> : null}
    </Card>
  );
}
