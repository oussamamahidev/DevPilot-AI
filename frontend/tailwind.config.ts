import type { Config } from "tailwindcss";

/**
 * DevPilot "Horizon" design system — Tailwind token layer.
 *
 * All semantic colors resolve to CSS custom properties defined in app/globals.css
 * (see :root for light, .dark for dark). Components must consume semantic utilities
 * (bg-surface, text-fg, border-line, bg-brand, ring-focus, bg-success-subtle, ...)
 * rather than raw palette classes, so the whole app themes from one source.
 *
 * Raw palette steps (brand-500, emerald-600, ...) remain available for data-viz /
 * fixed accents and are NOT theme-dependent.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "var(--dp-bg-canvas)",
        surface: "var(--dp-bg-surface)",
        raised: "var(--dp-bg-raised)",
        overlay: "var(--dp-bg-overlay)",
        sunken: "var(--dp-bg-sunken)",
        hover: "var(--dp-bg-hover)",
        backdrop: "var(--dp-overlay-backdrop)",

        // Text
        fg: {
          DEFAULT: "var(--dp-text-primary)",
          muted: "var(--dp-text-secondary)",
          subtle: "var(--dp-text-tertiary)",
          inverse: "var(--dp-text-inverse)",
        },

        // Borders / strokes (use as `border-line`, `border-line-strong`)
        line: {
          DEFAULT: "var(--dp-border-default)",
          strong: "var(--dp-border-strong)",
          subtle: "var(--dp-border-subtle)",
        },

        // Focus ring
        focus: "var(--dp-border-focus)",

        // Brand (Iris violet) — semantic + raw scale
        brand: {
          DEFAULT: "var(--dp-brand-solid)",
          hover: "var(--dp-brand-solid-hover)",
          fg: "var(--dp-brand-fg)",
          subtle: "var(--dp-brand-subtle-bg)",
          "subtle-line": "var(--dp-brand-subtle-border)",
          50: "#F2EEFF",
          100: "#E7DEFF",
          200: "#D0C0FF",
          300: "#B098FF",
          400: "#9470FF",
          500: "#7C4DFF",
          600: "#6A35F0",
          700: "#5826CC",
          800: "#461F9E",
          900: "#371B78",
          950: "#21124A",
        },

        // Status families (semantic, theme-aware)
        success: {
          DEFAULT: "var(--dp-success-solid)",
          fg: "var(--dp-success-fg)",
          subtle: "var(--dp-success-subtle-bg)",
          line: "var(--dp-success-subtle-border)",
          "surface-fg": "var(--dp-success-surface-fg)",
        },
        warning: {
          DEFAULT: "var(--dp-warning-solid)",
          fg: "var(--dp-warning-fg)",
          subtle: "var(--dp-warning-subtle-bg)",
          line: "var(--dp-warning-subtle-border)",
          "surface-fg": "var(--dp-warning-surface-fg)",
        },
        danger: {
          DEFAULT: "var(--dp-danger-solid)",
          fg: "var(--dp-danger-fg)",
          subtle: "var(--dp-danger-subtle-bg)",
          line: "var(--dp-danger-subtle-border)",
          "surface-fg": "var(--dp-danger-surface-fg)",
        },
        info: {
          DEFAULT: "var(--dp-info-solid)",
          fg: "var(--dp-info-fg)",
          subtle: "var(--dp-info-subtle-bg)",
          line: "var(--dp-info-subtle-border)",
          "surface-fg": "var(--dp-info-surface-fg)",
        },
      },

      fontFamily: {
        sans: ["var(--dp-font-sans)"],
        mono: ["var(--dp-font-mono)"],
      },

      borderRadius: {
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
      },

      boxShadow: {
        sm: "0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.10)",
        md: "0 4px 8px -2px rgb(16 24 40 / 0.10), 0 2px 4px -2px rgb(16 24 40 / 0.06)",
        lg: "0 12px 24px -6px rgb(16 24 40 / 0.12), 0 8px 16px -8px rgb(16 24 40 / 0.08)",
        xl: "0 24px 48px -12px rgb(16 24 40 / 0.18)",
      },

      ringColor: {
        DEFAULT: "var(--dp-border-focus)",
      },

      keyframes: {
        "dp-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "dp-slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "dp-fade-in": "dp-fade-in 180ms cubic-bezier(0,0,0.2,1)",
        "dp-slide-up": "dp-slide-up 180ms cubic-bezier(0.2,0.8,0.2,1)",
      },
    },
  },
  plugins: [],
};

export default config;
