type AvatarProps = {
  name?: string | null;
  email?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

const palette = [
  "bg-brand-subtle text-brand-fg",
  "bg-info-subtle text-info-surface-fg",
  "bg-success-subtle text-success-surface-fg",
  "bg-warning-subtle text-warning-surface-fg",
  "bg-danger-subtle text-danger-surface-fg",
];

function initialsOf(source: string) {
  const parts = source.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({ name, email, size = "md", className = "" }: AvatarProps) {
  const source = (name || email || "?").toString();
  const initials = initialsOf(source);
  const hash = source.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const tone = palette[hash % palette.length];

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${sizeClasses[size]} ${tone} ${className}`}
    >
      {initials}
    </span>
  );
}
