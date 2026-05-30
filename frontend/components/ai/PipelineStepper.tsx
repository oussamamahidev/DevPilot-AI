import { StatusBadge } from "@/components/ui/StatusBadge";
import type { RagOpsPipelineStage } from "@/types";

export function PipelineStepper({ steps }: { steps: RagOpsPipelineStage[] }) {
  return (
    <ol className="grid gap-3">
      {steps.map((step, index) => (
        <li key={step.name} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand text-xs font-semibold text-white">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize text-fg">{step.name.replace("_", " ")}</p>
              <StatusBadge status={step.status} />
            </div>
            {step.detail ? <p className="mt-1 text-sm leading-6 text-fg-muted">{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
