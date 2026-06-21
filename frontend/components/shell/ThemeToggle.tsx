"use client";

import { Icon } from "@/components/ui/Icon";
import { iconButtonClass } from "@/components/shell/styles";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={iconButtonClass}
    >
      <Icon name={resolved === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
