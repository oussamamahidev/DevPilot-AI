import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="bg-[#0a0b0e] border-t border-[#1c1f25] py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Left: logo + copyright */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#7c4dff] flex items-center justify-center">
            <span className="text-xs font-bold text-white select-none">DP</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-[#ecedee]">DevPilot AI</span>
            <p className="text-sm text-[#6b7280]">© 2025 DevPilot AI. All rights reserved.</p>
          </div>
        </div>

        {/* Right: links */}
        <nav className="flex items-center gap-6">
          <Link
            href="#"
            className="text-sm text-[#6b7280] hover:text-[#ecedee] transition-colors"
          >
            Documentation
          </Link>
          <Link
            href="#"
            className="text-sm text-[#6b7280] hover:text-[#ecedee] transition-colors"
          >
            GitHub
          </Link>
          <Link
            href="/login"
            className="text-sm text-[#6b7280] hover:text-[#ecedee] transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="text-sm text-[#6b7280] hover:text-[#ecedee] transition-colors"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </footer>
  );
}
