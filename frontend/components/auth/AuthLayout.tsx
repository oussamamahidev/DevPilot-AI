"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

const features = [
  "Search every document across your workspaces",
  "Answers grounded in sources you can verify",
  "Full retrieval & evaluation observability",
];

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  showBrand?: boolean;
};

export function AuthLayout({ title, subtitle, children, footer, showBrand = true }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-canvas">
      {showBrand ? (
        <aside className="relative hidden w-1/2 max-w-2xl flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 to-brand-800 p-10 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,rgba(255,255,255,0.18),transparent)]" />
          <Link href="/" className="relative flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white/15 text-sm font-bold">
              DP
            </span>
            <span className="text-sm font-semibold">DevPilot AI</span>
          </Link>
          <div className="relative max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Document intelligence, grounded in your sources.
            </h2>
            <ul className="mt-8 space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-white/90">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
                    <Icon name="check" size={13} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/70">Secure, multi-workspace AI for teams.</p>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-sm font-bold text-white">
              DP
            </span>
            <span className="text-sm font-semibold text-fg">DevPilot AI</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-2 sm:px-6">
          <div className="w-full max-w-sm">
            <header className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
              {subtitle ? <p className="mt-2 text-sm leading-6 text-fg-muted">{subtitle}</p> : null}
            </header>
            {children}
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
