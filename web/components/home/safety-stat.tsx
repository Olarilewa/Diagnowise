import { STUDY_URL } from "@/lib/home/links";
import { ExternalLink } from "./ui";

/** One statistic only, deliberately. It is a U.S. outpatient estimate and is labelled as such. */
export function SafetyStat() {
  return (
    <section aria-labelledby="stat-heading" className="border-y border-border-soft bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-16 md:grid-cols-[auto_1fr] md:gap-16 md:py-20">
        <p className="font-display text-[clamp(5.5rem,15vw,9.5rem)] font-extrabold leading-none tracking-tighter text-teal-deep">
          <span className="sr-only">One in twenty</span>
          <span aria-hidden="true">1 in 20</span>
        </p>
        <div>
          <h2 id="stat-heading" className="max-w-[26ch] font-display text-[clamp(1.4rem,3vw,1.9rem)] font-semibold leading-snug text-graphite">
            U.S. adults experience a diagnostic error in outpatient care each year.
          </h2>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-slate">
            An estimate. Here, a diagnostic error means a missed opportunity to make a timely or correct diagnosis.
          </p>
          <p className="mt-4 max-w-[64ch] text-[14px] leading-relaxed text-slate">
            Source: Singh H, Meyer ANDM, Thomas EJ.{" "}
            <ExternalLink href={STUDY_URL} className="font-medium text-teal-deep underline underline-offset-4">
              The frequency of diagnostic errors in outpatient care
            </ExternalLink>
            . BMJ Quality &amp; Safety, 2014. The study was partly funded by the Agency for Healthcare Research and Quality (AHRQ).
          </p>
        </div>
      </div>
    </section>
  );
}
