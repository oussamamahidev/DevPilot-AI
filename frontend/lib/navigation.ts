import type { IconName } from "@/components/ui/Icon";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
};

export const mainNav: NavItem[] = [
  { id: "dashboard", label: "Home", href: "/dashboard", icon: "home" },
  { id: "documents", label: "Documents", href: "/documents", icon: "file" },
  { id: "chat", label: "Chat", href: "/chat", icon: "message" },
  { id: "ai-execution-studio", label: "AI Studio", href: "/ai-execution-studio", icon: "zap" },
  { id: "architecture-explorer", label: "Architecture", href: "/architecture-explorer", icon: "workflow" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

export const adminNav: NavItem[] = [
  { id: "admin", label: "Overview", href: "/admin", icon: "grid" },
  { id: "ragops", label: "RAGOps", href: "/admin/ragops", icon: "activity" },
  { id: "rag-traces", label: "Traces", href: "/admin/rag-traces", icon: "layers" },
  { id: "quality", label: "Quality", href: "/admin/quality", icon: "shield" },
  { id: "users", label: "Users", href: "/admin/users", icon: "user" },
  { id: "admin-documents", label: "Documents", href: "/admin/documents", icon: "file" },
];

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  "audit-logs": "Audit Logs",
  chat: "Chat",
  dashboard: "Home",
  documents: "Documents",
  login: "Login",
  quality: "Quality",
  "rag-traces": "Traces",
  ragops: "RAGOps",
  register: "Register",
  settings: "Settings",
  users: "Users",
  workspaces: "Workspaces",
};

export type Crumb = { label: string; href?: string };

function isOpaqueId(segment: string) {
  return /^[0-9]+$/.test(segment) || /[0-9a-f]{8}-/i.test(segment) || segment.length >= 16;
}

function prettify(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Build truncatable breadcrumbs from a pathname; resolves known ids (e.g. active workspace name). */
export function buildBreadcrumbs(
  pathname: string,
  context?: { workspaceName?: string | null },
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";

  segments.forEach((segment, index) => {
    href += `/${segment}`;
    const isLast = index === segments.length - 1;

    let label: string;
    if (SEGMENT_LABELS[segment]) {
      label = SEGMENT_LABELS[segment];
    } else if (isOpaqueId(segment)) {
      label =
        segments[index - 1] === "workspaces" && context?.workspaceName
          ? context.workspaceName
          : "Detail";
    } else {
      label = prettify(segment);
    }

    crumbs.push({ label, href: isLast ? undefined : href });
  });

  return crumbs;
}
