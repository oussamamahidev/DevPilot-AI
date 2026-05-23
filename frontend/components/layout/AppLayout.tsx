import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

type AppLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function AppLayout({ children, className = "" }: AppLayoutProps) {
  return (
    <div className={`min-h-screen bg-slate-50 ${className}`}>
      <Navbar />
      {children}
    </div>
  );
}
