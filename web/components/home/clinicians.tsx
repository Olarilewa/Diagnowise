import Link from "next/link";
import { Eyebrow, H2, btnPrimary } from "./ui";

const VALUE = [
  ["Structure the presentation", "Turn a clinical picture into organized, reviewable information."],
  ["Explore alternatives", "Look at possible and alternative diagnoses, not only the first one."],
  ["Find what must not be missed", "Surface dangerous conditions that should be considered."],
  ["Weigh the evidence", "See supporting and contradictory evidence side by side."],
  ["See what is missing", "Identify clinical information that has not yet been gathered."],
  ["Reassess", "Revisit a diagnosis when new information becomes available."],
];

export function Clinicians({ tryHref }: { tryHref: string }) {
  return (
    <section id="clinicians" aria-labelledby="clinicians-heading" className="scroll-mt-20 border-t border-border-soft bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <Eyebrow>For clinicians</Eyebrow>
          <H2 id="clinicians-heading">Think beyond the first diagnosis.</H2>
          <p className="mt-5 text-[17px] leading-[1.75] text-graphite">
            Diagnowise gives clinicians a structured second perspective, helping them explore differential diagnoses, identify red flags, challenge assumptions and recognize what may have been overlooked.
          </p>
        </div>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {VALUE.map(([title, text]) => (
            <li key={title} className="bg-porcelain p-6">
              <h3 className="font-display text-[17px] font-semibold text-graphite">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href={tryHref} className={btnPrimary}>
            Try a case
          </Link>
          <p className="max-w-[46ch] text-[15px] leading-relaxed text-slate">It supports a more disciplined reasoning process. It supports clinical judgment; it does not replace it.</p>
        </div>
      </div>
    </section>
  );
}
