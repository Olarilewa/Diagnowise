import { FlowDiagram } from "@/components/flow-diagram";
import { Check, Eyebrow, H2 } from "./ui";

const DOES = [
  "Organizes clinical information into a clear picture",
  "Explores possible explanations, not just the first one",
  "Identifies dangerous alternatives that should not be missed",
  "Examines supporting and contradictory evidence",
  "Recognizes missing information",
  "Reassesses when new information becomes available",
];

export function ReasoningLoop() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 border-t border-border-soft bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <Eyebrow>How Diagnowise works</Eyebrow>
          <H2 id="how-heading">A disciplined clinical reasoning loop.</H2>
          <p className="mt-5 text-[17px] leading-[1.75] text-slate">Every case moves through the same sequence, and nothing closes without a look back at what could have been missed.</p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-porcelain px-4 py-6 sm:px-8">
          <FlowDiagram />
        </div>

        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="font-display text-[20px] font-semibold">What it does</h3>
            <ul className="mt-4 space-y-3 text-[16px] leading-relaxed text-graphite">
              {DOES.map((d) => (
                <li key={d} className="flex gap-3">
                  <Check />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[15px] leading-relaxed text-slate">Human clinical judgment remains responsible for interpreting findings and making clinical decisions.</p>
          </div>

          <figure>
            <p className="font-display text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-snug tracking-tight">Never &ldquo;AI says cancer.&rdquo; Always why.</p>
            <p className="mt-3 text-[15px] leading-relaxed text-slate">Every possibility that is surfaced comes with its reasoning attached.</p>
            <div className="mt-5 rounded-2xl border border-border bg-white p-5 shadow-card" style={{ borderLeft: "3px solid var(--critical)" }}>
              <figcaption className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">Illustrative example, not patient data</figcaption>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-semibold">Gastric malignancy</span>
                <span className="rounded-full bg-danger-wash px-2.5 py-0.5 text-[12px] font-semibold text-danger">Moderate likelihood</span>
              </div>
              <p className="mt-3 text-[13px] font-semibold text-slate">Why this is being surfaced</p>
              <ul className="mt-1.5 space-y-1 text-[14px] text-graphite">
                {["Persistent symptoms despite treatment", "Unintentional weight loss", "Age-related risk factor", "Family history of gastric cancer"].map((r) => (
                  <li key={r} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-critical" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
