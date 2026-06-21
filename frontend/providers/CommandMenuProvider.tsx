"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { CommandMenuContext } from "@/providers/command-menu-context";

export { useCommandMenu } from "@/providers/command-menu-context";

export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandMenuContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandPalette />
    </CommandMenuContext.Provider>
  );
}
