import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { AuthTopLink } from "./auth-top-link";

const TRUST_LABELS = [
  { label: "AI-generated", meaning: "Proposed by the system. Always open to review.", dot: "border border-white/70 bg-transparent" },
  { label: "Clinician-confirmed", meaning: "A clinician has reviewed it and agreed.", dot: "bg-teal-soft" },
  { label: "Patient-reported", meaning: "Said by the patient. Not verified.", dot: "bg-[#9fc4ee]" },
  { label: "System-derived", meaning: "Worked out from recorded data.", dot: "bg-white/50" },
];

/** Soft topographic lines: decorative only. */
function Contours() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 760 900" preserveAspectRatio="xMidYMid slice" fill="none">
      {Array.from({ length: 16 }).map((_, i) => (
        <path key={i} d={`M-20 ${70 + i * 54} C 120 ${20 + i * 54} 240 ${130 + i * 54} 380 ${70 + i * 54} S 640 ${10 + i * 54} 800 ${80 + i * 54}`} stroke="white" strokeOpacity={0.05 + (i % 4) * 0.012} strokeWidth="1.25" />
      ))}
    </svg>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-porcelain lg:grid lg:grid-cols-[minmax(440px,5fr)_7fr]">
      <aside className="relative hidden overflow-hidden bg-teal-ink text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <Contours />
        <div className="relative">
          <Link href="/" aria-label="Diagnowise home">
            <Wordmark tone="light" />
          </Link>
        </div>

        <div className="relative max-w-[460px]">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-soft">Clinical reasoning, made safer</p>
          <h2 className="font-display text-[40px] font-semibold leading-[1.12] tracking-tight">Before we conclude, what might we be missing?</h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/70">
            Diagnowise helps clinicians widen the differential, helps patients know when to seek care, and shows hospitals where diagnostic care falls through the cracks.
          </p>

          <div className="mt-10 border-t border-white/15 pt-6">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">How we label everything you see</p>
            <dl className="space-y-3.5">
              {TRUST_LABELS.map((t) => (
                <div key={t.label} className="flex items-baseline gap-3">
                  <span className={`mt-[3px] inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full ${t.dot}`} />
                  <div className="text-[14px] leading-snug">
                    <dt className="inline font-semibold text-white">{t.label}</dt>
                    <dd className="inline text-white/60"> &mdash; {t.meaning}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="relative text-[13px] text-white/50">AI proposes. Clinicians decide. Diagnowise is decision support, never a diagnosis.</p>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link href="/" className="lg:invisible" aria-label="Diagnowise home">
            <Wordmark />
          </Link>
          <AuthTopLink />
        </header>
        <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 sm:px-10 lg:items-center lg:pt-0">
          <div className="w-full max-w-[460px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
