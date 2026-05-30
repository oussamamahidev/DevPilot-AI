import { Badge } from "@/components/ui/Badge";

export function RoleBadge({ role }: { role: string }) {
  if (role === "super_admin") {
    return <Badge tone="critical">super admin</Badge>;
  }
  if (role === "admin") {
    return <Badge tone="ai">admin</Badge>;
  }
  return <Badge tone="info">{role.replace(/_/g, " ")}</Badge>;
}
