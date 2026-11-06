import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { patientHref, tryCaseHref } from "@/lib/home/cta";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/home/hero";
import { SafetyStat } from "@/components/home/safety-stat";
import { WhyExists } from "@/components/home/why-exists";
import { ReasoningLoop } from "@/components/home/reasoning-loop";
import { Patients } from "@/components/home/patients";
import { Clinicians } from "@/components/home/clinicians";
import { Hospitals } from "@/components/home/hospitals";
import { OpenSource } from "@/components/home/open-source";
import { Developers } from "@/components/home/developers";
import { FinalCta } from "@/components/home/final-cta";

export default async function LandingPage() {
  // The page must never fail because auth is unavailable: fall back to the visitor view.
  const user = await getCurrentUser(getRouteHandlerSupabaseClient()).catch(() => null);
  const role = user?.profile.role ?? null;
  const tryHref = tryCaseHref(role);
  const patientsOpen = process.env.PATIENT_SIGNUP_ENABLED === "true";

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-graphite focus:shadow-card">
        Skip to content
      </a>
      <SiteHeader tryHref={tryHref} />
      <main id="main">
        <Hero tryHref={tryHref} />
        <SafetyStat />
        <WhyExists />
        <ReasoningLoop />
        <Patients href={patientHref(role, patientsOpen)} />
        <Clinicians tryHref={tryHref} />
        <Hospitals />
        <OpenSource />
        <Developers />
        <FinalCta tryHref={tryHref} />
      </main>
      <SiteFooter patientsOpen={patientsOpen} />
    </>
  );
}
