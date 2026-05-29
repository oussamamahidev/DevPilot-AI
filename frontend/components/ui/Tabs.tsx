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
    <div className="border-b border-slate-200">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={
              item.id === activeId
                ? "max-w-full border-b-2 border-slate-950 px-3 py-3 text-sm font-medium text-slate-950"
                : "max-w-full border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-950"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
