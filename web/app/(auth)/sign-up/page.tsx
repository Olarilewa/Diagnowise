import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, HeartPulse, Stethoscope } from "lucide-react";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";

type Role = { href: string; icon: typeof Stethoscope; title: string; blurb: string; points: string[]; soon?: boolean };

export default async function SignUpChooserPage() {
  const user = await getCurrentUser(getRouteHandlerSupabaseClient());
  if (user) redirect("/dashboard");
  const patientsOpen = process.env.PATIENT_SIGNUP_ENABLED === "true";

  const roles: Role[] = [
    { href: "/sign-up/patient", icon: HeartPulse, title: "I'm a patient", blurb: "Understand your symptoms and know when to seek care, then share what you've found with a clinician you choose.", points: ["Plain-language guidance", "You choose who sees it"], soon: !patientsOpen },
    { href: "/sign-up/clinician", icon: Stethoscope, title: "I'm a clinician", blurb: "Think through cases, widen the differential, and catch what is easy to miss before a case is closed.", points: ["Case workspace", "Red-flag checks"] },
    { href: "/sign-up/hospital", icon: Building2, title: "I represent a hospital or clinic", blurb: "Bring your facility onto Diagnowise and see where diagnostic care needs a second look across your organization.", points: ["Facility profile", "Diagnostic safety overview"] },
  ];

  return (
    <div>
      <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight text-graphite">Create your account</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-slate">Choose how you&apos;ll use Diagnowise. Each has its own short setup.</p>

      <ul className="mt-8 space-y-3.5">
        {roles.map((r) => {
          const Icon = r.icon;
          const inner = (
            <>
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-wash text-teal-deep">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-[17px] font-semibold text-graphite">{r.title}</span>
                  {r.soon && <span className="rounded-full bg-warning-wash px-2 py-0.5 text-[11px] font-semibold text-warning">Opening soon</span>}
                </span>
                <span className="mt-1 block text-[14px] leading-relaxed text-slate">{r.blurb}</span>
                <span className="mt-2.5 block text-[13px] font-medium text-teal-deep">{r.points.join("  ·  ")}</span>
              </span>
              {!r.soon && <ArrowRight size={18} className="mt-1 shrink-0 text-slate-2 transition group-hover:translate-x-0.5 group-hover:text-teal-deep" />}
            </>
          );
          return (
            <li key={r.href}>
              {r.soon ? (
                <div aria-disabled="true" className="flex gap-4 rounded-2xl border border-border-soft bg-white/60 p-5 opacity-80">
                  {inner}
                </div>
              ) : (
                <Link href={r.href} className="group flex gap-4 rounded-2xl border border-border bg-white p-5 shadow-card transition hover:-translate-y-px hover:border-teal-accent">
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {!patientsOpen && <p className="mt-5 text-[13px] leading-relaxed text-slate">Patient accounts open once clinicians have reviewed the guidance wording. If you need care now, please contact a clinician or your local emergency number.</p>}
    </div>
  );
}
