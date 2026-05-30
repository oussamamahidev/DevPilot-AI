import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

type AppLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function AppLayout({ children, className = "" }: AppLayoutProps) {
  return (
    <div className={`min-h-screen bg-canvas ${className}`}>
      <Navbar />
      {children}
    </div>
  );
}
