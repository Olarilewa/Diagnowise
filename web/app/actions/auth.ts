"use server";

import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireAuth } from "@/lib/security/auth";
import { handleCompleteOnboarding } from "@/lib/signup/complete-onboarding";
import type { OnboardingInput } from "@/lib/signup/schemas";

export async function completeOnboarding(input: OnboardingInput): Promise<{ error?: string }> {
  const result = await handleCompleteOnboarding(getRouteHandlerSupabaseClient(), input);
  if (result.error || !result.redirectTo) return { error: result.error ?? "Something went wrong." };
  redirect(result.redirectTo);
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
