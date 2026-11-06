import Link from "next/link";
import { Info } from "lucide-react";
import { Check, Eyebrow, H2, btnPrimary } from "./ui";

const VALUE = [
  "Understand symptoms and relevant health information.",
  "Explore possible explanations without treating AI suggestions as confirmed diagnoses.",
  "Recognize warning signs that require prompt professional attention.",
  "Organize relevant information to communicate more effectively with healthcare providers.",
  "Understand why professional examination, investigations and follow-up may be necessary.",
];

/** `href` is null while patient accounts are closed: we show the honest status instead of a button that goes nowhere. */
export function Patients({ href }: { href: string | null }) {
  return (
    <section id="patients" aria-labelledby="patients-heading" className="scroll-mt-20 border-t border-border-soft bg-teal-wash/70">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[7fr_5fr] md:gap-16 md:py-28">
        <div>
          <Eyebrow>For patients</Eyebrow>
          <H2 id="patients-heading">Understand your health. Ask better questions.</H2>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.75] text-graphite">
            Diagnowise helps patients make sense of their health concerns, understand possible explanations for their symptoms and prepare for more informed conversations with healthcare professionals.
          </p>
          <ul className="mt-7 space-y-3 text-[16px] leading-relaxed text-graphite">
            {VALUE.map((v) => (
              <li key={v} className="flex gap-3">
                <Check />
                <span>{v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            {href ? (
              <Link href={href} className={btnPrimary}>
                Understand your health
              </Link>
            ) : (
              <p className="inline-block rounded-xl border border-teal-soft bg-white px-4 py-3 text-[15px] text-graphite">
                <span className="font-semibold">Patient accounts are opening soon.</span> We are reviewing the patient experience with clinicians first.
              </p>
            )}
          </div>
        </div>

        <aside aria-label="What Diagnowise is not for patients" className="self-start rounded-2xl border border-teal-soft bg-white p-6 shadow-card">
          <div className="flex items-center gap-2.5 text-teal-deep">
            <Info size={20} aria-hidden="true" />
            <h3 className="font-display text-[18px] font-semibold text-graphite">A clear boundary</h3>
          </div>
          <p className="mt-4 text-[16px] leading-relaxed text-graphite">
            Diagnowise helps you understand and prepare. It is not a diagnosis, it does not replace an examination, and it is not a treatment service.
          </p>
          <p className="mt-3 text-[16px] leading-relaxed text-graphite">See a clinician before starting any treatment. In an emergency, call your local emergency number.</p>
        </aside>
      </div>
    </section>
  );
}
