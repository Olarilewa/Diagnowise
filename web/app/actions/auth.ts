"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireAuth } from "@/lib/security/auth";

const ROLES_REQUIRING_ORGANIZATION = ["clinician", "medical_student", "hospital_admin"] as const;

const onboardingSchema = z.object({
  role: z.enum(["clinician", "medical_student", "hospital_admin", "researcher"]),
  specialty: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().max(200).optional(),
  organizationType: z.enum(["hospital", "clinic", "academic", "other"]).optional(),
  country: z.string().trim().max(120).optional(),
});

export interface OnboardingInput {
  role: "clinician" | "medical_student" | "hospital_admin" | "researcher";
  specialty: string;
  organizationName?: string;
  organizationType?: "hospital" | "clinic" | "academic" | "other";
  country?: string;
}

export async function completeOnboarding(input: OnboardingInput): Promise<{ error?: string }> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in all required fields." };
  }
  const body = parsed.data;

  const supabase = getRouteHandlerSupabaseClient();
  const user = await requireAuth(supabase);

  let organizationId: string | null = null;
  const needsOrganization = (ROLES_REQUIRING_ORGANIZATION as readonly string[]).includes(body.role);

  if (needsOrganization) {
    if (!body.organizationName) {
      return { error: "An organization name is required for this role." };
    }
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: body.organizationName,
        type: body.organizationType ?? "hospital",
        country: body.country ?? null,
      })
      .select("id")
      .single();
    if (orgError || !org) {
      return { error: `Could not set up your organization: ${orgError?.message ?? "unknown error"}` };
    }
    organizationId = org.id;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      role: body.role,
      specialty: body.specialty,
      organization_id: organizationId,
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: `Could not save your profile: ${updateError.message}` };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = getRouteHandlerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Whether the current session's profile still needs onboarding (specialty unset is the signal). */
export async function needsOnboarding(): Promise<boolean> {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await requireAuth(supabase);
  return !user.profile.specialty;
}
