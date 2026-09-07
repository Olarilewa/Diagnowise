"use server";

import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireAuth } from "@/lib/security/auth";
import { handleAnalyzeCase } from "@/lib/clinical/handlers";
import { createPatientSchema, createCaseSchema } from "@/lib/validation/schemas";

const createCaseInputSchema = z.object({
  age: z.number().int().min(0).max(130),
  sex: z.enum(["male", "female", "other", "unspecified"]),
  setting: z.string().trim().max(120).optional(),
  presentingComplaint: z.string().trim().min(1).max(4000),
  additionalHistory: z.array(z.object({ label: z.string().min(1).max(200), value: z.string().min(1).max(500) })).max(10).default([]),
});

export interface CreateCaseInput {
  age: number;
  sex: "male" | "female" | "other" | "unspecified";
  setting?: string;
  presentingComplaint: string;
  additionalHistory?: { label: string; value: string }[];
}

/**
 * Creates a patient (minimal PII, per spec §30/§31) and a draft case
 * against it. Split from analyzeCase below so the clinician gets a real,
 * persisted case immediately — if the AI analysis step fails or is slow,
 * the case still exists and can be retried, rather than losing everything
 * because one step didn't complete.
 */
export async function createCase(input: CreateCaseInput): Promise<{ caseId?: string; error?: string }> {
  const parsed = createCaseInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the case details and try again." };
  const body = parsed.data;

  const supabase = getRouteHandlerSupabaseClient();
  const user = await requireAuth(supabase);

  if (!user.profile.organization_id) {
    return { error: "Your account isn't linked to an organization yet. Complete onboarding first." };
  }

  const externalReference = `PT-${1000 + Math.floor(Math.random() * 8999)}`;
  const patientInput = createPatientSchema.safeParse({ external_reference: externalReference, age: body.age, sex: body.sex });
  if (!patientInput.success) return { error: "Could not create the patient record." };

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({ organization_id: user.profile.organization_id, ...patientInput.data })
    .select("id")
    .single();
  if (patientError || !patient) return { error: `Could not create patient: ${patientError?.message ?? "unknown error"}` };

  const caseInput = createCaseSchema.safeParse({ patient_id: patient.id, setting: body.setting, presenting_complaint: body.presentingComplaint });
  if (!caseInput.success) return { error: "Could not create the case." };

  const { data: newCase, error: caseError } = await supabase
    .from("cases")
    .insert({
      patient_id: patient.id,
      clinician_id: user.id,
      setting: caseInput.data.setting,
      presenting_complaint: caseInput.data.presenting_complaint,
    })
    .select("id")
    .single();
  if (caseError || !newCase) return { error: `Could not create case: ${caseError?.message ?? "unknown error"}` };

  if (body.additionalHistory.length > 0) {
    await supabase
      .from("symptoms")
      .insert(body.additionalHistory.map((h) => ({ case_id: newCase.id, name: h.label, duration: h.value, source: "clinician" as const })));
  }

  await supabase.from("case_timeline_events").insert({
    case_id: newCase.id,
    event: "Initial presentation",
    detail: body.presentingComplaint.length > 90 ? body.presentingComplaint.slice(0, 90) + "…" : body.presentingComplaint,
  });

  return { caseId: newCase.id };
}

/**
 * Runs the real reasoning pipeline against an existing case and persists
 * the result. Calls handleAnalyzeCase directly rather than making an HTTP
 * request to this app's own /api/clinical/analyze endpoint — Server
 * Actions already run server-side, so routing through HTTP would just add
 * latency for no benefit. The HTTP endpoint still exists and behaves
 * identically for external callers (see web/lib/clinical/handlers.ts).
 */
export async function analyzeCase(caseId: string): Promise<{ error?: string }> {
  const supabase = getRouteHandlerSupabaseClient();
  try {
    await handleAnalyzeCase({ supabase }, { caseId });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Analysis failed. Please try again." };
  }
}
