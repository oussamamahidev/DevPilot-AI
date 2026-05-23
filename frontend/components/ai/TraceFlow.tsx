import { StatusBadge } from "@/components/ui/StatusBadge";

type TraceFlowStep = {
  label: string;
  status?: string | null;
};

export function TraceFlow({ steps }: { steps: TraceFlowStep[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((step, index) => (
        <div key={`${step.label}-${index}`} className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Step {index + 1}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-950">{step.label}</span>
            <StatusBadge status={step.status ?? "completed"} />
          </div>
        </div>
      ))}
    </div>
  );
}
