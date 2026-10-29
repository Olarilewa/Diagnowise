import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { parseSignupIntent } from "@/lib/signup/schemas";
import { AuthShell } from "@/components/auth/auth-shell";
import { FinishClinician } from "./finish-clinician";
import { FinishHospital } from "./finish-hospital";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");
  if (user.profile.role === "patient") redirect("/patient");
  if (user.profile.specialty) redirect(user.profile.role === "hospital_admin" ? "/hospital" : "/dashboard");

  // What the person chose on the sign-up page. Re-validated here: metadata is user-controlled.
  const { data } = await supabase.auth.getUser();
  const intent = parseSignupIntent(data.user?.user_metadata);

  return (
    <AuthShell>
      {intent?.intent === "hospital" ? (
        <FinishHospital
          initial={{ name: intent.hospital_name, institutionType: intent.institution_type, careScope: intent.care_scope, careScopeDetail: intent.care_scope_detail ?? "", country: intent.country ?? "" }}
        />
      ) : intent?.intent === "clinician" ? (
        <FinishClinician workplaceName={intent.workplace_name} />
      ) : (
        <OnboardingWizard defaultName={user.profile.name} />
      )}
    </AuthShell>
  );
}
