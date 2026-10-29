import { Info } from "lucide-react";
import type { PatientExplanation } from "@diagnowise/core";

const Label = ({ children }: { children: React.ReactNode }) => <h4 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-2">{children}</h4>;
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="mt-1.5 space-y-1.5 text-[15px] leading-relaxed text-graphite">
    {items.map((t) => (
      <li key={t} className="flex gap-2.5">
        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-accent" />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

/**
 * Order is deliberate and fixed: the explanation comes FIRST, then the banner, then the possible
 * conditions, then the disclaimer. Every string here is validated in core before it can arrive.
 */
export function ExplanationSection({ e }: { e: PatientExplanation }) {
  return (
    <section className="mt-10" aria-labelledby="explain-heading">
      <h2 id="explain-heading" className="font-display text-[24px] font-semibold tracking-tight">
        What might be going on
      </h2>
      <div className="mt-3 space-y-3.5 text-[16px] leading-[1.7] text-graphite">
        {e.overview.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      <div role="note" className="mt-9 flex gap-3 rounded-xl border border-warning/40 bg-warning-wash px-4 py-3.5">
        <Info size={18} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <div className="text-[15px] font-semibold text-graphite">{e.banner}</div>
          <p className="mt-0.5 text-[14px] leading-snug text-slate">Please see a clinician before starting any treatment.</p>
        </div>
      </div>

      <ul className="mt-4 space-y-3.5">
        {e.conditions.map((c) => (
          <li key={c.name} className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-[19px] font-semibold tracking-tight">{c.name}</h3>
              {c.canBeSerious && <span className="rounded-full bg-warning-wash px-2.5 py-0.5 text-[12px] font-semibold text-warning">Can be serious. Needs a clinician&apos;s assessment</span>}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-graphite">{c.whatItIs}</p>
            {c.whyItCouldFit.length > 0 && (
              <>
                <Label>Why it could fit</Label>
                <Bullets items={c.whyItCouldFit} />
              </>
            )}
            {c.whatMakesItLessLikely.length > 0 && (
              <>
                <Label>What makes it less likely</Label>
                <Bullets items={c.whatMakesItLessLikely} />
              </>
            )}
          </li>
        ))}
      </ul>

      {e.questionsToAsk.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-[17px] font-semibold">Questions you could ask a clinician</h3>
          <Bullets items={e.questionsToAsk} />
        </div>
      )}

      <div className="mt-9 rounded-xl border-l-4 border-teal-deep bg-teal-wash px-5 py-4 text-[14px] leading-relaxed text-graphite">{e.disclaimer}</div>
    </section>
  );
}
