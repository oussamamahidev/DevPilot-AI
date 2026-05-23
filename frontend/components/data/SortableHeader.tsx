type SortDirection = "asc" | "desc" | null;

type SortableHeaderProps = {
  direction?: SortDirection;
  label: string;
  onClick: () => void;
};

export function SortableHeader({ direction = null, label, onClick }: SortableHeaderProps) {
  const marker = direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium uppercase text-slate-500 hover:text-slate-950"
    >
      {label}
      <span aria-hidden="true">{marker}</span>
    </button>
  );
}
