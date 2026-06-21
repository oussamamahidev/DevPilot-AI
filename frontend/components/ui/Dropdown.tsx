"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type TriggerState = {
  open: boolean;
  toggle: () => void;
  ref: RefObject<HTMLButtonElement | null>;
  triggerProps: { "aria-haspopup": "menu"; "aria-expanded": boolean };
};

type DropdownProps = {
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  trigger: (state: TriggerState) => ReactNode;
  children: (state: { close: () => void }) => ReactNode;
};

export function Dropdown({
  align = "end",
  className = "inline-flex",
  panelClassName = "",
  trigger,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    // Move focus into the menu.
    const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    first?.focus();

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) {
      return;
    }
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length;
    else next = index <= 0 ? items.length - 1 : index - 1;
    items[next]?.focus();
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {trigger({
        open,
        toggle,
        ref: triggerRef,
        triggerProps: { "aria-haspopup": "menu", "aria-expanded": open },
      })}
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          onKeyDown={onPanelKeyDown}
          className={`absolute top-full z-[1300] mt-2 max-h-[min(28rem,calc(100vh-5rem))] min-w-[12rem] max-w-[calc(100vw-1.5rem)] animate-dp-slide-up overflow-y-auto overflow-x-hidden rounded-lg border border-line bg-raised p-1 text-fg shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}

type DropdownItemProps = {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  icon?: ReactNode;
  trailing?: ReactNode;
};

export function DropdownItem({
  children,
  onSelect,
  disabled,
  tone = "default",
  icon,
  trailing,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none transition focus-visible:bg-hover disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "text-danger-fg hover:bg-danger-subtle focus-visible:bg-danger-subtle"
          : "text-fg hover:bg-hover"
      }`}
    >
      {icon ? <span className="shrink-0 text-fg-subtle">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="shrink-0 text-fg-subtle">{trailing}</span> : null}
    </button>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
      {children}
    </p>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
