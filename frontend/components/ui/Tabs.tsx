"use client";

import type { ReactNode } from "react";

type TabItem = {
  id: string;
  label: ReactNode;
};

type TabsProps = {
  activeId: string;
  items: TabItem[];
  onChange: (id: string) => void;
};

export function Tabs({ activeId, items, onChange }: TabsProps) {
  return (
    <div role="tablist" className="border-b border-line">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={`max-w-full rounded-t-md border-b-2 px-3 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                isActive
                  ? "border-brand text-fg"
                  : "border-transparent text-fg-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
