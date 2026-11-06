import { Github } from "lucide-react";
import { REPO_URL } from "@/lib/home/links";
import { Check, Eyebrow, ExternalLink, H2, btnPrimary } from "./ui";

const CAN = [
  "Explore the reasoning engine.",
  "Inspect the codebase and architecture.",
  "Understand the clinical reasoning workflow.",
  "Contribute improvements.",
  "Research approaches to explainable clinical intelligence.",
  "Help build more accessible diagnostic safety infrastructure.",
];

export function Developers() {
  return (
    <section id="developers" aria-labelledby="dev-heading" className="scroll-mt-20 border-t border-border-soft">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:gap-16 md:py-28">
        <div>
          <Eyebrow>For developers and researchers</Eyebrow>
          <H2 id="dev-heading">Help build the future of open clinical intelligence.</H2>
          <p className="mt-5 text-[17px] leading-[1.75] text-graphite">
            Diagnowise is built in the open. Developers, researchers, clinicians and AI practitioners can inspect the code, understand the reasoning architecture, challenge its assumptions and contribute to a shared effort to make diagnostic intelligence more transparent and accessible.
          </p>
        </div>
        <div>
          <h3 className="font-display text-[18px] font-semibold">What you can do</h3>
          <ul className="mt-4 space-y-3 text-[16px] leading-relaxed text-graphite">
            {CAN.map((c) => (
              <li key={c} className="flex gap-3">
                <Check />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ExternalLink href={REPO_URL} className={btnPrimary}>
              <Github size={18} aria-hidden="true" /> Explore GitHub
            </ExternalLink>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-[13px] font-semibold text-graphite">Apache 2.0</span>
          </div>
        </div>
      </div>
    </section>
  );
}
