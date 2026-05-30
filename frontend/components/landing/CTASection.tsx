"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );
    const el = ref.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function CTASection() {
  const { ref, inView } = useInView();

  return (
    <section className="relative py-32 overflow-hidden bg-[#0a0b0e]">
      {/* Radial violet glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(124,77,255,0.2), transparent)",
        }}
      />

      {/* Content */}
      <div
        ref={ref}
        className={`relative z-10 text-center mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Badge */}
        <span className="rounded-full border border-[#272b33] bg-[#111317] px-4 py-1.5 text-xs text-[#a0a6b0] inline-block mb-8">
          Open Source · Self-Hostable · Enterprise Ready
        </span>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
          <span className="text-[#ecedee]">Build Trustworthy</span>
          <br />
          <span className="bg-gradient-to-r from-[#9470ff] via-[#b098ff] to-[#9470ff] bg-clip-text text-transparent">
            AI Systems
          </span>
        </h2>

        {/* Subheading */}
        <p className="text-lg text-[#a0a6b0] max-w-xl mx-auto mt-6 leading-relaxed">
          Join engineering teams using DevPilot AI to deploy accurate, observable, citable AI on
          their own infrastructure.
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mt-10">
          <Link
            href="/register"
            className="rounded-lg bg-[#7c4dff] px-8 py-4 text-base font-semibold text-white hover:bg-[#9470ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-[#272b33] bg-[#111317] px-8 py-4 text-base font-semibold text-[#ecedee] hover:bg-[#181b20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c4dff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
          >
            Sign In
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-[#6b7280]">
          Open source · Apache 2.0 · Deploy on your infrastructure
        </p>
      </div>
    </section>
  );
}
