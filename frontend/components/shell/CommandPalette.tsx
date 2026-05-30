"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { useCommandMenu } from "@/providers/command-menu-context";
import { useWorkspaces } from "@/providers/WorkspaceProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdmin } from "@/lib/permissions";
import { adminNav, mainNav } from "@/lib/navigation";

type Command = {
  id: string;
  label: string;
  group: string;
  icon: IconName;
  keywords?: string;
  run: () => void;
};

export function CommandPalette() {
  const { open, setOpen } = useCommandMenu();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { workspaces, setActiveWorkspaceId } = useWorkspaces();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const nav: Command[] = mainNav.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      group: "Navigation",
      icon: item.icon,
      run: go(item.href),
    }));
    const admin: Command[] = canAccessAdmin(user)
      ? adminNav.map((item) => ({
          id: `admin-${item.id}`,
          label: `Admin · ${item.label}`,
          group: "Navigation",
          icon: item.icon,
          keywords: "admin",
          run: go(item.href),
        }))
      : [];
    const ws: Command[] = workspaces.map((workspace) => ({
      id: `ws-${workspace.id}`,
      label: `Switch to ${workspace.name}`,
      group: "Workspaces",
      icon: "box",
      keywords: "workspace switch",
      run: () => {
        setActiveWorkspaceId(workspace.id);
        setOpen(false);
        router.push(`/workspaces/${workspace.id}`);
      },
    }));
    const actions: Command[] = [
      { id: "act-new-chat", label: "New chat", group: "Actions", icon: "message", run: go("/chat") },
      { id: "act-upload", label: "Upload document", group: "Actions", icon: "file", run: go("/documents") },
      {
        id: "act-theme-dark",
        label: "Theme: Dark",
        group: "Actions",
        icon: "moon",
        keywords: "theme appearance",
        run: () => {
          setTheme("dark");
          setOpen(false);
        },
      },
      {
        id: "act-theme-light",
        label: "Theme: Light",
        group: "Actions",
        icon: "sun",
        keywords: "theme appearance",
        run: () => {
          setTheme("light");
          setOpen(false);
        },
      },
      {
        id: "act-theme-system",
        label: "Theme: System",
        group: "Actions",
        icon: "monitor",
        keywords: "theme appearance",
        run: () => {
          setTheme("system");
          setOpen(false);
        },
      },
    ];
    if (user) {
      actions.push({
        id: "act-logout",
        label: "Log out",
        group: "Actions",
        icon: "logout",
        run: () => {
          setOpen(false);
          logout();
        },
      });
    }
    return [...nav, ...admin, ...ws, ...actions];
  }, [user, workspaces, router, setOpen, setActiveWorkspaceId, setTheme, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return commands;
    }
    return commands.filter((command) =>
      `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((value) => Math.min(value + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((value) => Math.max(value - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        filtered[index]?.run();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, filtered, index, setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-cmd-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index, open]);

  if (!open) {
    return null;
  }

  const groups = Array.from(new Set(filtered.map((command) => command.group)));
  let running = -1;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-start justify-center overflow-y-auto bg-backdrop px-4 pb-6 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl animate-dp-slide-up overflow-hidden rounded-xl border border-line bg-overlay text-fg shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={18} className="text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or jump to…"
            aria-label="Command search"
            className="h-12 w-full min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-fg-muted">
              No results for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group} className="mb-1">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  {group}
                </p>
                {filtered
                  .filter((command) => command.group === group)
                  .map((command) => {
                    running += 1;
                    const itemIndex = running;
                    const active = itemIndex === index;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        data-cmd-index={itemIndex}
                        onMouseMove={() => setIndex(itemIndex)}
                        onClick={() => command.run()}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition ${
                          active ? "bg-hover text-fg" : "text-fg-muted"
                        }`}
                      >
                        <Icon name={command.icon} size={16} className="shrink-0 text-fg-subtle" />
                        <span className="min-w-0 flex-1 truncate">{command.label}</span>
                        {active ? (
                          <Icon name="chevronRight" size={14} className="shrink-0 text-fg-subtle" />
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
