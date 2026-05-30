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
      aria-label={`Sort by ${label}`}
      className="inline-flex items-center gap-1 rounded text-xs font-medium uppercase tracking-wide text-fg-subtle transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      {label}
      <span aria-hidden="true">{marker}</span>
    </button>
  );
}
