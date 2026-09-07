"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const TONE_COLORS: Record<string, string> = {
  default: "var(--border)",
  danger: "var(--danger)",
  critical: "var(--critical)",
  warning: "var(--warning)",
  info: "var(--teal-accent)",
};

export function Disclosure({
  title,
  subtitle,
  defaultOpen = false,
  tone = "default",
  rightSlot,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  tone?: keyof typeof TONE_COLORS;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${TONE_COLORS[tone]}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-graphite">{title}</div>
          {subtitle && <div className="text-xs mt-0.5 text-slate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <ChevronDown size={16} className={`text-slate transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
