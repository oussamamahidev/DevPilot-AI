import type { ReactNode } from "react";

export function Kbd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-sunken px-1.5 font-sans text-[11px] font-medium text-fg-muted ${className}`}
    >
      {children}
    </kbd>
  );
}
