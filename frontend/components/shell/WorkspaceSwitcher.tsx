"use client";

import { useRouter } from "next/navigation";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { Icon } from "@/components/ui/Icon";
import { useWorkspaces } from "@/providers/WorkspaceProvider";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspaceId } = useWorkspaces();

  return (
    <Dropdown
      align="start"
      className={collapsed ? "inline-flex" : "block w-full"}
      panelClassName="w-[min(16rem,calc(100vw-1.5rem))]"
      trigger={({ toggle, ref, triggerProps }) => (
        <button
          ref={ref}
          onClick={toggle}
          {...triggerProps}
          title={collapsed ? activeWorkspace?.name ?? "Select workspace" : undefined}
          className={`flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-2 text-left text-sm transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            collapsed ? "justify-center" : "w-full"
          }`}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand text-white">
            <Icon name="box" size={16} />
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] uppercase tracking-wide text-fg-subtle">
                  Workspace
                </span>
                <span className="block truncate font-medium text-fg">
                  {activeWorkspace?.name ?? "Select workspace"}
                </span>
              </span>
              <Icon name="selector" size={16} className="shrink-0 text-fg-subtle" />
            </>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <DropdownLabel>Workspaces</DropdownLabel>
          {workspaces.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-fg-muted">No workspaces yet</p>
          ) : (
            workspaces.map((workspace) => (
              <DropdownItem
                key={workspace.id}
                icon={<Icon name="box" size={16} />}
                trailing={
                  activeWorkspace?.id === workspace.id ? (
                    <Icon name="check" size={16} className="text-brand-fg" />
                  ) : undefined
                }
                onSelect={() => {
                  setActiveWorkspaceId(workspace.id);
                  router.push(`/workspaces/${workspace.id}`);
                  close();
                }}
              >
                {workspace.name}
              </DropdownItem>
            ))
          )}
          <DropdownSeparator />
          <DropdownItem
            icon={<Icon name="plus" size={16} />}
            onSelect={() => {
              router.push("/dashboard#workspaces");
              close();
            }}
          >
            Create workspace
          </DropdownItem>
        </div>
      )}
    </Dropdown>
  );
}
