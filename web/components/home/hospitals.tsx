import Link from "next/link";
import { DOCS_URL } from "@/lib/home/links";
import { Eyebrow, ExternalLink, H2, btnOnDark } from "./ui";

const OPPORTUNITIES = [
  ["Unresolved clinical cases", "Cases where diagnostic questions remain unanswered or need further assessment."],
  ["High-risk cases", "Situations that may need additional attention, escalation or review."],
  ["Abnormal results without appropriate action", "Laboratory or investigation findings that may have been overlooked or not followed up."],
  ["Missed patient follow-ups", "Patients who need further evaluation but may not have returned or received appropriate follow-up."],
  ["Repeated diagnoses and persistent symptoms", "Recurring symptoms or repeated diagnoses that may warrant another assessment."],
  ["Referral delays", "Gaps between recognizing the need for specialist attention and completing the referral."],
];

const DIRECTION = [
  "Self-hosted institutional deployments",
  "Greater control over infrastructure and data environments",
  "Adaptation to local clinical workflows",
  "Future integration with electronic health records and hospital information systems",
  "Future institutional analytics and diagnostic safety monitoring",
];

export function Hospitals() {
  return (
    <section id="hospitals" aria-labelledby="hospitals-heading" className="scroll-mt-20 bg-teal-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <Eyebrow dark>For hospitals</Eyebrow>
          <H2 id="hospitals-heading" dark>
            See diagnostic risks before they become adverse outcomes.
          </H2>
          <p className="mt-5 text-[17px] leading-[1.75] text-white/80">
            Diagnowise is being developed as an open clinical intelligence layer that can help hospitals identify diagnostic safety risks, recognize gaps in clinical follow-up and strengthen the processes behind patient care.
          </p>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div>
            <h3 className="font-display text-[20px] font-semibold">What this is being built to help identify</h3>
            <ol className="mt-5 divide-y divide-white/15 border-y border-white/15">
              {OPPORTUNITIES.map(([title, text], i) => (
                <li key={title} className="grid grid-cols-[2rem_1fr] gap-x-3 py-4">
                  <span aria-hidden="true" className="font-display text-[15px] font-semibold text-teal-soft">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold">{title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-white/75">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[14px] leading-relaxed text-white/75">These describe the direction of development. They are not running in any hospital today.</p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/20 bg-white/[0.06] p-6">
              <h3 className="font-display text-[18px] font-semibold">Where this stands today</h3>
              <dl className="mt-4 space-y-4 text-[15px] leading-relaxed">
                <div>
                  <dt className="font-semibold text-teal-soft">Available now</dt>
                  <dd className="mt-1 text-white/80">Register your facility and set up its profile (early stage; profiles are unverified). Clinicians can use the case workspace.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-teal-soft">In development</dt>
                  <dd className="mt-1 text-white/80">Diagnostic safety signals and an organization-level overview. The groundwork exists in the codebase; there is no hospital dashboard yet.</dd>
                </div>
              </dl>
            </div>
            <blockquote className="border-l-2 border-teal-soft pl-5 text-[17px] leading-relaxed text-white/90">
              Rather than waiting for an adverse outcome to discover that something was missed, Diagnowise aims to help healthcare institutions develop more proactive diagnostic safety processes.
            </blockquote>
          </div>
        </div>

        <div className="mt-14 grid gap-10 border-t border-white/15 pt-10 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div>
            <h3 className="font-display text-[18px] font-semibold">What an open-source architecture makes possible</h3>
            <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-white/80">
              {DIRECTION.map((d) => (
                <li key={d} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-soft" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-white/75">Direction, not shipped features. Integrations and analytics are not built yet.</p>
          </div>
          <div className="flex flex-col items-start gap-4">
            <ExternalLink href={DOCS_URL} className={btnOnDark}>
              Explore institutional deployment
            </ExternalLink>
            <Link href="/sign-up/hospital" className="text-[15px] font-semibold text-white underline underline-offset-4 hover:text-teal-soft">
              Register your facility
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
