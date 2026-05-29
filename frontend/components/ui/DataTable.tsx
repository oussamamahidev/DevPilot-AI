"use client";

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
  if (isLoading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (items.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="admin-table-scroll bg-white shadow-sm">
      <table className="admin-table">
        <thead className="border-b border-slate-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={
                  column.align === "right"
                    ? "text-right"
                    : undefined
                }
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const href = getRowHref?.(item);
            return (
              <tr
                key={getRowKey(item)}
                className={href ? "hover:bg-slate-50" : undefined}
                onClick={() => {
                  if (href) {
                    window.location.assign(href);
                  }
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.align === "right"
                        ? "text-right text-slate-700"
                        : "text-slate-700"
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
