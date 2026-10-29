"use server";

import type { PatientExplanation, PatientGuidance } from "@diagnowise/core";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { handlePatientReport, type PatientReportInput } from "@/lib/patient/submit-report";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "@/lib/utilities/errors";

export type SubmitPatientReportResult =
  | { ok: true; guidance: PatientGuidance; explanation: PatientExplanation | null; reportId: string | null; assessedByAi: boolean }
  | { ok: false; error: string };

export async function submitPatientReport(input: Omit<PatientReportInput, "acknowledgedAiProcessing"> & { acknowledgedAiProcessing: boolean }): Promise<SubmitPatientReportResult> {
  try {
    const result = await handlePatientReport({ supabase: getRouteHandlerSupabaseClient() }, input);
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: "Please check the form and try again." };
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) return { ok: false, error: "Please sign in with your patient account." };
    console.error("submitPatientReport failed", err instanceof Error ? err.message : err);
    // Deliberately generic, and deliberately safety-minded: a failure here must not read as reassurance.
    return { ok: false, error: "We couldn't process this just now. If you are worried about your health, please contact a clinician or your local emergency number." };
  }
}
