import { Github } from "lucide-react";
import { LICENSE_URL, REPO_URL } from "@/lib/home/links";
import { Eyebrow, ExternalLink, H2, btnPrimary, btnSecondary } from "./ui";

const VALUES = [
  ["Transparent", "See how every output is produced, not just the result."],
  ["Accessible", "No licence fee, and no vendor between you and the code."],
  ["Inspectable", "Technical reviewers and researchers can examine and challenge the reasoning."],
  ["Community-built", "Clinicians, developers and researchers can all contribute."],
];

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="oss-heading" className="scroll-mt-20 border-t border-border-soft bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <Eyebrow>The difference</Eyebrow>
          <H2 id="oss-heading">Free and open source. Licensed under Apache 2.0. Self-hostable.</H2>
          <p className="mt-5 text-[17px] leading-[1.75] text-graphite">Inspect the code, understand how the platform works, adapt the infrastructure and build on an open foundation for clinical intelligence.</p>
        </div>
        <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(([t, d]) => (
            <div key={t} className="bg-porcelain p-6">
              <dt className="font-display text-[17px] font-semibold">{t}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-slate">{d}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <ExternalLink href={REPO_URL} className={btnPrimary}>
            <Github size={18} aria-hidden="true" /> View on GitHub
          </ExternalLink>
          <ExternalLink href={LICENSE_URL} className={btnSecondary}>
            Read the Apache 2.0 licence
          </ExternalLink>
        </div>
        <p className="mt-5 max-w-[62ch] text-[14px] leading-relaxed text-slate">Self-hosting may require your own infrastructure and AI-provider credentials, which may incur separate costs.</p>
      </div>
    </section>
  );
}
