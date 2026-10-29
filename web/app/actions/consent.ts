"use server";

import { revalidatePath } from "next/cache";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { createShareCode, revokeConsent as revoke, shareWithClinician as share } from "@/lib/patient/consent";
import { ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError } from "@/lib/utilities/errors";

export type ShareActionResult =
  | { ok: true; status: "ok" | "already_shared"; clinicianName: string }
  | { ok: false; error: string };

export async function shareWithClinician(code: string): Promise<ShareActionResult> {
  try {
    const r = await share(getRouteHandlerSupabaseClient(), { code });
    if (r.status === "ok" || r.status === "already_shared") {
      revalidatePath("/patient/sharing");
      return { ok: true, status: r.status, clinicianName: r.clinicianName };
    }
    if (r.status === "rate_limited") return { ok: false, error: "Too many attempts. Please wait an hour and try again, or ask your clinician for a new code." };
    return { ok: false, error: "That code isn't valid, or it has expired. Ask your clinician for a new one." };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: "Please enter the code exactly as your clinician gave it." };
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) return { ok: false, error: "Please sign in with your patient account." };
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function stopSharing(consentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await revoke(getRouteHandlerSupabaseClient(), { consentId });
    revalidatePath("/patient/sharing");
    return { ok: true };
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, error: "This was already stopped." };
    return { ok: false, error: "Could not stop sharing. Please try again." };
  }
}

export async function generateShareCode(): Promise<{ ok: true; code: string; validUntil: string } | { ok: false; error: string }> {
  try {
    const r = await createShareCode(getRouteHandlerSupabaseClient());
    return { ok: true, ...r };
  } catch {
    return { ok: false, error: "Could not create a sharing code. Please try again." };
  }
}
