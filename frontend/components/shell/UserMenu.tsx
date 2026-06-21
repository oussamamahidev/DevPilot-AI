"use client";

import { useRouter } from "next/navigation";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme } from "@/providers/ThemeProvider";

const themeOptions: { value: Theme; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) {
    return null;
  }

  return (
    <Dropdown
      align="end"
      panelClassName="w-64"
      trigger={({ toggle, ref, triggerProps }) => (
        <button
          ref={ref}
          onClick={toggle}
          {...triggerProps}
          aria-label="Account menu"
          className="rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Avatar name={user.full_name} email={user.email} size="md" />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={user.full_name} email={user.email} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {user.full_name || user.email}
              </p>
              <p className="truncate text-xs text-fg-subtle">{user.email}</p>
            </div>
          </div>
          <div className="px-2.5 pb-2">
            <RoleBadge role={user.role} />
          </div>
          <DropdownSeparator />
          <DropdownItem
            icon={<Icon name="settings" size={16} />}
            onSelect={() => {
              router.push("/settings");
              close();
            }}
          >
            Settings
          </DropdownItem>
          <DropdownSeparator />
          <DropdownLabel>Theme</DropdownLabel>
          {themeOptions.map((option) => (
            <DropdownItem
              key={option.value}
              icon={<Icon name={option.icon} size={16} />}
              trailing={
                theme === option.value ? (
                  <Icon name="check" size={16} className="text-brand-fg" />
                ) : undefined
              }
              onSelect={() => setTheme(option.value)}
            >
              {option.label}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem
            tone="danger"
            icon={<Icon name="logout" size={16} />}
            onSelect={() => {
              logout();
              close();
            }}
          >
            Log out
          </DropdownItem>
        </div>
      )}
    </Dropdown>
  );
}
