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
        "teal-ink": "var(--teal-ink)",
        "teal-soft": "var(--teal-soft)",
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
      boxShadow: {
        card: "0 1px 2px rgba(7,48,45,0.06), 0 12px 28px -14px rgba(7,48,45,0.22)",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Manrope Variable"', '"Inter Variable"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
