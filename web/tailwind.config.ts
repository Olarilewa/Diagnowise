import type { Config } from "tailwindcss";

/**
 * The color palette from the original design system (build doc §06),
 * exposed as real Tailwind classes (bg-teal-deep, text-slate, etc.) backed
 * by CSS custom properties in app/globals.css — one source of truth for
 * the actual color value, real Tailwind ergonomics everywhere it's used.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        porcelain: "var(--porcelain)",
        graphite: "var(--graphite)",
        slate: "var(--slate)",
        "slate-2": "var(--slate-2)",
        border: "var(--border)",
        "border-soft": "var(--border-soft)",
        "teal-deep": "var(--teal-deep)",
        "teal-accent": "var(--teal-accent)",
        "teal-wash": "var(--teal-wash)",
        success: "var(--success)",
        "success-wash": "var(--success-wash)",
        warning: "var(--warning)",
        "warning-wash": "var(--warning-wash)",
        danger: "var(--danger)",
        "danger-wash": "var(--danger-wash)",
        critical: "var(--critical)",
        "critical-wash": "var(--critical-wash)",
        info: "var(--info)",
        "info-wash": "var(--info-wash)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-manrope)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
