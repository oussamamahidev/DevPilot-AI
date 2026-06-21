"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export type DataTableColumn<TItem> = {
  align?: "left" | "right";
  header: string;
  key: string;
  render: (item: TItem) => ReactNode;
};

type DataTableProps<TItem> = {
  columns: DataTableColumn<TItem>[];
  emptyDescription?: string;
  emptyTitle?: string;
  getRowHref?: (item: TItem) => string | undefined;
  getRowKey: (item: TItem) => string;
  isLoading?: boolean;
  items: TItem[];
};

export function DataTable<TItem>({
  columns,
  emptyDescription,
  emptyTitle = "No records found",
  getRowHref,
  getRowKey,
  isLoading = false,
  items,
}: DataTableProps<TItem>) {
  const router = useRouter();

  if (isLoading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (items.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="admin-table-scroll bg-surface shadow-sm">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.align === "right" ? "text-right" : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const href = getRowHref?.(item);
            const navigate = () => {
              if (href) {
                router.push(href);
              }
            };
            return (
              <tr
                key={getRowKey(item)}
                className={
                  href
                    ? "cursor-pointer transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                    : undefined
                }
                role={href ? "link" : undefined}
                tabIndex={href ? 0 : undefined}
                onClick={href ? navigate : undefined}
                onKeyDown={
                  href
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate();
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.align === "right" ? "text-right text-fg-muted" : "text-fg-muted"
                    }
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
