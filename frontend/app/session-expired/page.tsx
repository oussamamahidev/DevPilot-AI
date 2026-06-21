"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AuthLayout } from "@/components/auth/AuthLayout";

const REDIRECT_SECONDS = 20;
const linkClass =
  "rounded font-medium text-brand-fg transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export default function SessionExpiredPage() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (seconds <= 0) {
      router.replace("/login");
    }
  }, [seconds, router]);

  return (
    <AuthLayout
      title="Your session expired"
      subtitle="For your security, you were signed out after a period of inactivity."
      footer={
        <Link href="/" className={linkClass}>
          Back to home
        </Link>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning-subtle text-warning-fg">
            <Icon name="clock" size={20} />
          </span>
          <p className="text-sm text-fg-muted">
            Sign back in to pick up where you left off — your work is safe.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={() => router.replace("/login")}>
          Sign in again
        </Button>
        <p aria-live="polite" className="text-center text-xs text-fg-subtle">
          Redirecting to sign in in {Math.max(seconds, 0)}s
        </p>
      </div>
    </AuthLayout>
  );
}
