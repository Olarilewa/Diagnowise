import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { BackLink } from "@/components/auth/back-link";
import { Notice } from "@/components/auth/fields";
import { PatientSignUpForm } from "./patient-sign-up-form";

export default async function PatientSignUpPage() {
  if (await getCurrentUser(getRouteHandlerSupabaseClient())) redirect("/dashboard");

  // Launch gate: stays closed until the owner enables it after clinical review of the patient wording.
  if (process.env.PATIENT_SIGNUP_ENABLED !== "true") {
    return (
      <div>
        <BackLink />
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Patient accounts aren&apos;t open yet</h1>
        <div className="mt-5">
          <Notice>We&apos;re still reviewing this part of Diagnowise with clinicians. If you need care now, please contact a clinician or your local emergency number.</Notice>
        </div>
      </div>
    );
  }
  return (
    <div>
      <BackLink />
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Create your account</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-slate">Understand your symptoms and know when to seek care.</p>
      <div className="mt-8">
        <PatientSignUpForm />
      </div>
    </div>
  );
}
