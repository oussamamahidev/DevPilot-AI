"use client";

import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { NotificationCenter } from "@/components/shell/NotificationCenter";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { UserMenu } from "@/components/shell/UserMenu";
import { iconButtonClass } from "@/components/shell/styles";
import { useCommandMenu } from "@/providers/command-menu-context";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { setOpen } = useCommandMenu();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className={`${iconButtonClass} lg:hidden`}
      >
        <Icon name="menu" size={20} />
      </button>

      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        <Breadcrumbs />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open command menu"
          className="hidden h-9 items-center gap-2 rounded-md border border-line bg-surface pl-2.5 pr-2 text-sm text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:inline-flex"
        >
          <Icon name="search" size={16} />
          <span className="text-fg-subtle">Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open command menu"
          className={`${iconButtonClass} md:hidden`}
        >
          <Icon name="search" size={18} />
        </button>
        <ThemeToggle />
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}
