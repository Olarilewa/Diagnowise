import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { FlowDiagram } from "@/components/flow-diagram";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function LandingPage() {
  return (
    <div>
      <SiteHeader />

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-6 text-xs font-semibold bg-teal-wash text-teal-deep">
          Clinical decision support &amp; diagnostic safety
        </div>
        <h1 className="font-display font-extrabold leading-[1.08] mx-auto" style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)", maxWidth: 760 }}>
          The second pair of eyes in clinical reasoning.
        </h1>
        <p className="mt-6 mx-auto text-base md:text-lg leading-relaxed text-slate" style={{ maxWidth: 620 }}>
          Diagnowise helps clinicians systematically explore differential diagnoses, identify diagnostic red flags, and
          recognize what may be missing before a case is closed.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/sign-up" className="rounded-lg px-5 py-3 text-sm font-semibold bg-teal-deep text-white flex items-center gap-2">
            Start a Case <ArrowRight size={15} />
          </Link>
          <a href="#how-it-works" className="rounded-lg px-5 py-3 text-sm border border-border">
            See How It Works
          </a>
        </div>
      </section>

      {/* FLOW DIAGRAM */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl px-4 py-6 bg-white border border-border">
          <FlowDiagram />
        </div>
        <p className="text-center text-xs mt-4 text-slate-2">
          Every case moves through the same disciplined reasoning loop — nothing closes without a look back at what
          could have been missed.
        </p>
      </section>

      {/* PRODUCT */}
      <section id="product" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-2xl mb-2">Built around the Diagnostic Workspace</h2>
          <p className="text-sm text-slate">Everything a clinician needs to think through a case, in one place.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { title: "Differential diagnosis", points: ["Generated with supporting and contradicting evidence", "Dangerous diagnoses flagged, never buried"] },
            { title: "Diagnostic safety", points: ["Red-flag detection on every case", "Contradiction detection when the picture doesn't add up"] },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl p-6 bg-white border border-border">
              <div className="font-semibold text-base mb-4 font-display">{c.title}</div>
              <ul className="space-y-2">
                {c.points.map((p) => (
                  <li key={p} className="text-sm flex items-start gap-2 text-slate">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal-accent" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* EXPLAINABILITY PREVIEW */}
      <section id="safety" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-3 text-teal-deep">Explainable by design</div>
            <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight mb-4">Never &quot;AI says cancer.&quot; Always why.</h2>
            <p className="text-sm leading-relaxed mb-4 text-slate">
              Every surfaced possibility comes with its reasoning attached — the supporting evidence, what&apos;s
              missing, and what would change the picture. Clinicians stay in control of the judgment call.
            </p>
            <p className="text-sm leading-relaxed text-slate">
              Diagnowise doesn&apos;t replace clinical judgment. It strengthens it by making it harder to overlook what
              matters.
            </p>
          </div>
          <div className="rounded-2xl p-5 bg-white border-l-[3px]" style={{ borderLeftColor: "var(--critical)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">Gastric malignancy</span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-danger-wash text-danger">
                Moderate likelihood
              </span>
            </div>
            <p className="text-xs mb-3 text-slate">Requires consideration given the current combination of symptoms and risk indicators.</p>
            <div className="text-xs font-semibold mb-2 text-slate-2">Why this is being surfaced</div>
            <ul className="space-y-1.5">
              {["Persistent symptoms despite treatment", "Unintentional weight loss", "Age-related risk factor", "Family history of gastric cancer"].map(
                (r) => (
                  <li key={r} className="text-xs flex items-start gap-2 text-graphite">
                    <span className="mt-1 w-1 h-1 rounded-full shrink-0 bg-critical" /> {r}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display font-bold text-2xl md:text-3xl leading-snug mb-2">Every clinician deserves a second pair of eyes.</h2>
        <p className="text-sm text-slate">And the technology behind that shouldn&apos;t have to remain a black box.</p>
      </section>

      <SiteFooter />
    </div>
  );
}
