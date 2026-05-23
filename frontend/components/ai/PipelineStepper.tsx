import { StatusBadge } from "@/components/ui/StatusBadge";
import type { RagOpsPipelineStage } from "@/types";

export function PipelineStepper({ steps }: { steps: RagOpsPipelineStage[] }) {
  return (
    <ol className="grid gap-3">
      {steps.map((step, index) => (
        <li key={step.name} className="flex gap-3 rounded-md border border-slate-200 bg-white p-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-950 text-xs font-semibold text-white">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize text-slate-950">{step.name.replace("_", " ")}</p>
              <StatusBadge status={step.status} />
            </div>
            {step.detail ? <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
