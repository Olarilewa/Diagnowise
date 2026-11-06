import Link from "next/link";
import { Github } from "lucide-react";
import { REPO_URL } from "@/lib/home/links";
import { ExternalLink, btnOnDark, btnOutlineOnDark } from "./ui";

export function FinalCta({ tryHref }: { tryHref: string }) {
  return (
    <section aria-labelledby="final-heading" className="bg-teal-deep text-white">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-24">
        <h2 id="final-heading" className="font-display text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.1] tracking-tight">
          Start with a single case.
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-[17px] leading-relaxed text-white/85">Free and open source. Decision support that keeps clinical judgment where it belongs.</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link href={tryHref} className={btnOnDark}>
            Try a case
          </Link>
          <ExternalLink href={REPO_URL} className={btnOutlineOnDark}>
            <Github size={18} aria-hidden="true" /> View on GitHub
          </ExternalLink>
        </div>
      </div>
    </section>
  );
}
