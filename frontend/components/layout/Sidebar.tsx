import Link from "next/link";

export type SidebarItem = {
  href: string;
  key: string;
  label: string;
};

type SidebarProps = {
  activeKey?: string;
  items: SidebarItem[];
};

const activeClass = "rounded-md bg-brand px-3 py-2 text-sm font-medium text-white";
const inactiveClass =
  "rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-hover hover:text-fg";

export function Sidebar({ activeKey, items }: SidebarProps) {
  const activeItem = items.find((item) => item.key === activeKey) ?? items[0];

  return (
    <aside className="w-full min-w-0 rounded-lg border border-line bg-surface p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit">
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white">
          <span className="truncate">{activeItem?.label ?? "Navigation"}</span>
          <span aria-hidden="true" className="shrink-0 text-xs text-white/70 group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <nav className="mt-2 grid gap-1">
          {items.map((item) => (
            <Link
              key={`${item.key}-${item.href}-mobile`}
              href={item.href}
              className={item.key === activeKey ? activeClass : inactiveClass}
            >
              <span className="block truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
      </details>

      <nav className="hidden gap-1 lg:grid">
        {items.map((item) => (
          <Link
            key={`${item.key}-${item.href}`}
            href={item.href}
            className={item.key === activeKey ? activeClass : inactiveClass}
          >
            <span className="block truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
