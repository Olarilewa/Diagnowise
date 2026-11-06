import { Eyebrow, H2 } from "./ui";

const PROBLEMS = [
  { who: "Patients", text: "may struggle to understand what is happening to their health." },
  { who: "Clinicians", text: "must make decisions amid incomplete information, uncertainty and time pressure." },
  { who: "Hospitals", text: "may struggle to identify gaps across diagnostic processes and patient follow-up." },
];

export function WhyExists() {
  return (
    <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="grid gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
        <div>
          <Eyebrow>Why Diagnowise exists</Eyebrow>
          <H2 id="why-heading">Better understanding. Better reasoning. Safer diagnosis.</H2>
        </div>
        <div className="space-y-6 text-[17px] leading-[1.75] text-graphite">
          <p>Diagnostic errors can emerge when important symptoms are overlooked, assumptions go unchallenged, alternative diagnoses are not explored, investigations are misinterpreted or necessary follow-ups are missed.</p>
          <dl className="divide-y divide-border-soft border-y border-border-soft">
            {PROBLEMS.map((p) => (
              <div key={p.who} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <dt className="text-[15px] font-semibold text-teal-deep">{p.who}</dt>
                <dd className="text-[16px] leading-relaxed text-graphite">{p.text}</dd>
              </div>
            ))}
          </dl>
          <p>Diagnowise exists to contribute to a better approach through clinical intelligence that supports understanding, reasoning and diagnostic safety.</p>
        </div>
      </div>
    </section>
  );
}
