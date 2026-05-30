"use client";

import { createContext, useContext } from "react";

export type CommandMenuContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
};

export const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const ctx = useContext(CommandMenuContext);
  if (!ctx) {
    throw new Error("useCommandMenu must be used within CommandMenuProvider");
  }
  return ctx;
}
