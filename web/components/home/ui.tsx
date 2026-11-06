import type { AnchorHTMLAttributes, ReactNode } from "react";

export const btnPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-teal-deep px-6 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#094f4a] active:translate-y-px";
export const btnSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-[10px] border border-border bg-white px-6 text-[16px] font-semibold text-graphite transition hover:border-slate-2";
export const btnOnDark = "inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-white px-6 text-[16px] font-semibold text-teal-ink transition hover:bg-teal-wash";
export const btnOutlineOnDark = "inline-flex h-12 items-center justify-center gap-2 rounded-[10px] border border-white/40 px-6 text-[16px] font-semibold text-white transition hover:border-white hover:bg-white/10";

/** Opens in a new tab and says so to screen readers. */
export function ExternalLink({ href, children, ...rest }: { href: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] ${dark ? "text-teal-soft" : "text-teal-deep"}`}>{children}</p>;
}

export function H2({ id, children, dark = false }: { id: string; children: ReactNode; dark?: boolean }) {
  return (
    <h2 id={id} className={`font-display text-[clamp(1.9rem,4.2vw,2.8rem)] font-semibold leading-[1.1] tracking-tight ${dark ? "text-white" : "text-graphite"}`}>
      {children}
    </h2>
  );
}

export function Check({ dark = false }: { dark?: boolean }) {
  return <span aria-hidden="true" className={`mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full ${dark ? "bg-teal-soft" : "bg-teal-accent"}`} />;
}
