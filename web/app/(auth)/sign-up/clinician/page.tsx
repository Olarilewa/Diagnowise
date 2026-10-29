import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { BackLink } from "@/components/auth/back-link";
import { ClinicianSignUpForm } from "./clinician-sign-up-form";

export default async function ClinicianSignUpPage() {
  if (await getCurrentUser(getRouteHandlerSupabaseClient())) redirect("/dashboard");
  return (
    <div>
      <BackLink />
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Set up your clinician account</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-slate">A second pair of eyes on every case. It takes about a minute.</p>
      <div className="mt-8">
        <ClinicianSignUpForm />
      </div>
    </div>
  );
}
