import Link from "next/link";
import { Github } from "lucide-react";
import { HEADLINE, SUPPORTING } from "@/lib/home/copy";
import { REPO_URL } from "@/lib/home/links";
import { ExternalLink, btnPrimary, btnSecondary } from "./ui";

export function Hero({ tryHref }: { tryHref: string }) {
  return (
    <section aria-labelledby="hero-heading" className="mx-auto max-w-5xl px-6 pb-16 pt-12 text-center sm:pt-20 lg:pt-24">
      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-accent" />
        Open source &middot; Apache 2.0 &middot; Self-hostable
      </p>
      <h1 id="hero-heading" className="mx-auto mt-6 max-w-[17ch] font-display text-[clamp(2.4rem,6.4vw,4.6rem)] font-bold leading-[1.04] tracking-tight text-graphite">
        {HEADLINE}
      </h1>
      <p className="mx-auto mt-6 max-w-[42rem] text-[18px] leading-relaxed text-slate sm:text-[20px]">{SUPPORTING}</p>
      <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Link href={tryHref} className={btnPrimary}>
          Try a case
        </Link>
        <ExternalLink href={REPO_URL} className={btnSecondary}>
          <Github size={18} aria-hidden="true" /> View on GitHub
        </ExternalLink>
      </div>
      <p className="mt-5 text-[14px] text-slate">Decision support. It never replaces clinical judgment.</p>
    </section>
  );
}
