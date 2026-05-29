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

export function Sidebar({ activeKey, items }: SidebarProps) {
  const activeItem = items.find((item) => item.key === activeKey) ?? items[0];

  return (
    <aside className="w-full min-w-0 rounded-md border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit">
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white">
          <span className="truncate">{activeItem?.label ?? "Navigation"}</span>
          <span className="shrink-0 text-xs text-slate-300 group-open:rotate-180">⌄</span>
        </summary>
        <nav className="mt-2 grid gap-1">
          {items.map((item) => (
            <Link
              key={`${item.key}-${item.href}-mobile`}
              href={item.href}
              className={
                item.key === activeKey
                  ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }
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
            className={
              item.key === activeKey
                ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }
          >
            <span className="block truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
