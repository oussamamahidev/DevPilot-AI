import Link from "next/link";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
          {index > 0 ? <span>/</span> : null}
          {item.href && index < items.length - 1 ? (
            <Link href={item.href} className="font-medium text-slate-600 hover:text-slate-950">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-950">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
