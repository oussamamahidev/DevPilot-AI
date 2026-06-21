import { Button } from "@/components/ui/Button";

type PaginationProps = {
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  totalLabel?: string;
};

export function Pagination({
  canNext,
  canPrevious,
  onNext,
  onPrevious,
  page,
  totalLabel,
}: PaginationProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 sm:justify-end">
      {totalLabel ? <span className="mr-auto text-sm text-fg-muted">{totalLabel}</span> : null}
      <Button disabled={!canPrevious} onClick={onPrevious} size="sm" variant="secondary">
        Previous
      </Button>
      <span className="text-sm text-fg-muted">Page {page + 1}</span>
      <Button disabled={!canNext} onClick={onNext} size="sm" variant="secondary">
        Next
      </Button>
    </div>
  );
}
