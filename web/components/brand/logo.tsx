/** Two interlocking rings: "the second pair of eyes". */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <circle cx="12.5" cy="16" r="6.25" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="19.5" cy="16" r="6.25" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
    </svg>
  );
}

export function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className={`h-8 w-8 ${tone === "light" ? "text-white/15" : "text-teal-deep"}`} />
      <span className={`font-display text-[17px] font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-graphite"}`}>Diagnowise</span>
    </span>
  );
}
