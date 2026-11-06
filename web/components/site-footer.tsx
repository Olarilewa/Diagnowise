import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { DOCS_URL, LICENSE_URL, REPO_URL } from "@/lib/home/links";
import { ExternalLink } from "@/components/home/ui";

export function SiteFooter({ patientsOpen }: { patientsOpen: boolean }) {
  const link = "text-[14px] text-slate hover:text-graphite";
  return (
    <footer className="border-t border-border-soft bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-4 text-[14px] leading-relaxed text-slate">The second pair of eyes in clinical reasoning. Free and open source under the Apache 2.0 licence.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-3 sm:grid-cols-3">
            <div className="space-y-2.5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-graphite">Use it</p>
              <Link href="/sign-up/clinician" className={`block ${link}`}>For clinicians</Link>
              <Link href="/sign-up/hospital" className={`block ${link}`}>For hospitals</Link>
              {patientsOpen ? <Link href="/sign-up/patient" className={`block ${link}`}>For patients</Link> : <span className="block text-[14px] text-slate">Patients: opening soon</span>}
              <Link href="/sign-in" className={`block ${link}`}>Sign in</Link>
            </div>
            <div className="space-y-2.5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-graphite">Build it</p>
              <ExternalLink href={REPO_URL} className={`block ${link}`}>GitHub</ExternalLink>
              <ExternalLink href={DOCS_URL} className={`block ${link}`}>Documentation</ExternalLink>
              <ExternalLink href={LICENSE_URL} className={`block ${link}`}>Apache 2.0 licence</ExternalLink>
            </div>
          </nav>
        </div>
        <p className="mt-10 border-t border-border-soft pt-6 text-[13px] leading-relaxed text-slate">
          Diagnowise is a clinical reasoning support tool. It does not provide autonomous diagnosis or treatment, and its outputs must be reviewed by a clinician. It is not a substitute for professional medical advice.
        </p>
      </div>
    </footer>
  );
}
