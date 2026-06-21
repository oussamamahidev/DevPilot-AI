import { Icon } from "@/components/ui/Icon";

export function AuthError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-subtle px-3 py-2.5 text-sm text-danger-surface-fg animate-dp-fade-in"
    >
      <Icon name="alertCircle" size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}
