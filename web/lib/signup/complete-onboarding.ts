/**
 * Diagnowise web — finishing onboarding.
 *
 * Plain function (no Next.js imports) so it is unit-tested; app/actions/auth.ts
 * is a thin wrapper that redirects afterwards.
 *
 * Organization creation goes through the create_organization() database function
 * (migration 0009). v1 inserted into the table and asked for the new row back,
 * which Postgres refuses for someone who is not a member yet, so onboarding failed
 * for every clinician and hospital.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireAuth } from "@/lib/security/auth";
import { onboardingSchema, type OnboardingInput } from "./schemas";

const ROLES_REQUIRING_ORGANIZATION = ["clinician", "medical_student", "hospital_admin"] as const;

export async function handleCompleteOnboarding(supabase: SupabaseClient<Database>, input: OnboardingInput): Promise<{ error?: string; redirectTo?: string }> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please fill in all required fields." };
  const body = parsed.data;

  const user = await requireAuth(supabase);
  if (user.profile.role === "patient") return { error: "Patient accounts don't need this step." };

  const needsOrganization = (ROLES_REQUIRING_ORGANIZATION as readonly string[]).includes(body.role);

  if (needsOrganization) {
    if (!body.organizationName) return { error: "An organization name is required for this role." };
    const { error: orgError } = await supabase.rpc("create_organization", {
      p_name: body.organizationName,
      p_type: body.organizationType ?? "hospital",
      p_country: body.country ?? null,
      p_care_scope: body.careScope ?? null,
      p_care_scope_detail: body.careScopeDetail ?? null,
      p_role: body.role,
    });
    if (orgError) {
      console.error("create_organization failed", orgError.code);
      if (orgError.code === "P0001") return { error: "Your account is already set up with an organization." };
      return { error: "We couldn't set up your organization. Please try again." };
    }
    const { error: specialtyError } = await supabase.from("users").update({ specialty: body.specialty }).eq("id", user.id);
    if (specialtyError) return { error: "We couldn't save your profile. Please try again." };
  } else {
    const { error: updateError } = await supabase.from("users").update({ role: body.role, specialty: body.specialty }).eq("id", user.id);
    if (updateError) return { error: "We couldn't save your profile. Please try again." };
  }

  return { redirectTo: body.role === "hospital_admin" ? "/hospital" : "/dashboard" };
}
