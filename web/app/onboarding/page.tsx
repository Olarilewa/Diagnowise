import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        <OnboardingWizard defaultName={user.profile.name} />
      </div>
    </div>
  );
}
