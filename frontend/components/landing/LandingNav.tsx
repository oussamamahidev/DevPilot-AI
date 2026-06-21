"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Architecture", href: "#architecture" },
  { label: "RAGOps", href: "#ragops" },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0b0e]/95 backdrop-blur-md border-b border-[#1c1f25] shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] rounded-lg"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c4dff] shadow-lg shadow-[#7c4dff]/25 group-hover:bg-[#9470ff] transition-colors">
              <span className="text-xs font-bold text-white leading-none">DP</span>
            </div>
            <span className="text-[#ecedee] font-semibold text-sm tracking-tight hidden sm:block">
              DevPilot <span className="text-[#7c4dff]">AI</span>
            </span>
          </Link>

          {/* Center Nav Links — desktop only */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-[#a0a6b0] rounded-lg hover:text-[#ecedee] hover:bg-[#111317] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right side CTAs — desktop */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-[#272b33] bg-[#111317] px-5 py-2 text-sm font-semibold text-[#ecedee] hover:bg-[#181b20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-[#7c4dff] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9470ff] transition-colors shadow-lg shadow-[#7c4dff]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex md:hidden items-center justify-center h-9 w-9 rounded-lg text-[#a0a6b0] hover:text-[#ecedee] hover:bg-[#111317] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff]"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile menu — slide down */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        } border-b border-[#1c1f25] bg-[#0a0b0e]/98 backdrop-blur-md`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-5 pt-2 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 text-sm font-medium text-[#a0a6b0] rounded-lg hover:text-[#ecedee] hover:bg-[#111317] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff]"
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#1c1f25]">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg border border-[#272b33] bg-[#111317] px-6 py-3 text-sm font-semibold text-[#ecedee] hover:bg-[#181b20] transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff]"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg bg-[#7c4dff] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9470ff] transition-colors text-center shadow-lg shadow-[#7c4dff]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
