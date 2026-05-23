import type { AnswerEvaluation, RagTraceEvaluation } from "@/types";
import { EvaluationBadge } from "@/components/ai/EvaluationBadge";

type EvaluationMetricsProps = {
  evaluation?: AnswerEvaluation | RagTraceEvaluation | null;
};

export function EvaluationMetrics({ evaluation }: EvaluationMetricsProps) {
  if (!evaluation) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <EvaluationBadge label="Faithfulness" value={evaluation.faithfulness ?? 0} />
      <EvaluationBadge label="Relevance" value={evaluation.relevance ?? 0} />
      <EvaluationBadge label="Context" value={evaluation.context_precision ?? 0} />
      <EvaluationBadge
        inverted
        label="Hallucination"
        value={evaluation.hallucination_score ?? 0}
      />
    </div>
  );
}
