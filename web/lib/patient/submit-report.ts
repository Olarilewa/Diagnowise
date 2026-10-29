/**
 * Diagnowise web — patient report submission.
 *
 * What a patient submits is turned into guidance (fixed copy) and, when allowed and when it
 * passes every safety check, a plain-language explanation with possible diagnoses.
 *
 *  1. Emergency/crisis phrases are screened FIRST, with no model involved. On a match the AI is
 *     not called at all: the response is immediate, the patient's words are not sent to an
 *     external provider, and no explanation or diagnoses are produced.
 *  2. Otherwise the reasoning pipeline runs (extract, red flags, differential, missing info).
 *     Its raw output NEVER reaches the patient. The patient sees (a) the fixed-copy guidance and
 *     (b) the patient_explanation stage's output, which is constrained and validated in
 *     core/patient-safety/explanation.ts and rejected as a whole if any rule fails.
 *  3. The explanation is optional and independent: if it is switched off, finds nothing suitable,
 *     fails validation twice, or the provider errors, the patient still gets the guidance.
 *  4. If the whole AI analysis fails, the patient gets fail-safe "see a clinician soon" guidance.
 *  5. Guidance is returned even if saving the report fails.
 *  6. The patient must acknowledge that their text is processed by an AI service. The audit event
 *     records the urgency tier, never the patient's words.
 *  7. The saved report records only the NAMES of the possible conditions the patient was shown, so
 *     a clinician who receives the report knows what the patient has been told.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  buildPatientGuidance,
  screenPatientText,
  selectConditionsForPatient,
  type ClinicalContext,
  type PatientExplanation,
  type PatientGuidance,
  type PatientGuidanceInput,
  type ReasoningOrchestrator,
} from "@diagnowise/core";
import type { Database } from "@/types/database";
import { recordAuditEvent, requirePatient } from "@/lib/security/auth";
import { createStatelessOrchestrator } from "@/lib/ai/orchestrator";
import { validateBody } from "@/lib/validation/schemas";

export const patientReportInputSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  onset: z.string().trim().max(200).optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  age: z.number().int().min(0).max(130),
  sex: z.enum(["male", "female", "other", "unspecified"]),
  /** Must be literally true: the patient has been told an AI service processes this text. */
  acknowledgedAiProcessing: z.literal(true),
});
export type PatientReportInput = z.infer<typeof patientReportInputSchema>;

export interface PatientReportDeps {
  supabase: SupabaseClient<Database>;
  /** Injectable for tests; defaults to createStatelessOrchestrator(). */
  orchestratorFactory?: () => ReasoningOrchestrator;
  /**
   * Kill switch for AI-written possible diagnoses. Defaults to ON unless PATIENT_DIAGNOSES_ENABLED
   * is set to "false", so they can be switched off without closing the rest of the patient area.
   */
  explanationEnabled?: boolean;
}

export interface PatientReportResult {
  guidance: PatientGuidance;
  /** null when switched off, not suitable, rejected by safety validation, or the AI was unavailable. */
  explanation: PatientExplanation | null;
  /** null if the report could not be saved (guidance is still returned). */
  reportId: string | null;
  assessedByAi: boolean;
}

async function runAnalysis(orchestrator: ReasoningOrchestrator, input: PatientReportInput) {
  const history: ClinicalContext["history"] = [];
  if (input.onset) history.push({ label: "Onset", value: input.onset, source: "patient" });
  if (input.severity) history.push({ label: "Severity as described by patient", value: input.severity, source: "patient" });
  const context: ClinicalContext = {
    caseId: `patient-${randomUUID()}`,
    patient: { age: input.age, sex: input.sex },
    presentingComplaint: input.summary,
    history,
  };
  const normalized = await orchestrator.runNormalization(context);
  const redFlags = await orchestrator.runRedFlags(context, normalized.output);
  const differential = await orchestrator.runDifferential(context, normalized.output, redFlags.output);
  const missing = await orchestrator.runMissingInformation(context, normalized.output, differential.output);
  const analysis: PatientGuidanceInput = { redFlags: redFlags.output, differential: differential.output, missingInformation: missing.output };
  return { context, normalized: normalized.output, redFlags: redFlags.output, differential: differential.output, analysis };
}

export async function handlePatientReport(deps: PatientReportDeps, rawInput: unknown): Promise<PatientReportResult> {
  const user = await requirePatient(deps.supabase);
  const input = validateBody(patientReportInputSchema, rawInput);
  const patientText = [input.summary, input.onset].filter(Boolean).join(" ");

  const screen = screenPatientText(patientText);
  const emergency = screen.category === "crisis" || screen.category === "medical";
  const explanationEnabled = deps.explanationEnabled ?? process.env.PATIENT_DIAGNOSES_ENABLED !== "false";

  let analysis: PatientGuidanceInput | null = null;
  let explanation: PatientExplanation | null = null;
  if (!emergency) {
    const orchestrator = (deps.orchestratorFactory ?? createStatelessOrchestrator)();
    try {
      const run = await runAnalysis(orchestrator, input);
      analysis = run.analysis;
      if (explanationEnabled && selectConditionsForPatient(run.differential).length > 0) {
        try {
          explanation = (await orchestrator.runPatientExplanation(run.context, run.normalized, run.redFlags, run.differential)).output;
        } catch (err) {
          // Fail closed: nothing from the model is shown. Never log the patient's text.
          console.error("Patient explanation withheld.", err instanceof Error ? err.message : err);
          explanation = null;
        }
      }
    } catch (err) {
      console.error("Patient analysis failed; using fail-safe guidance.", err instanceof Error ? err.message : err);
      analysis = null;
      explanation = null;
    }
  }

  const guidance = buildPatientGuidance({ analysis, patientText });

  let reportId: string | null = null;
  const { data, error } = await deps.supabase
    .from("patient_reports")
    .insert({
      patient_id: user.id,
      summary: input.summary,
      onset: input.onset ?? null,
      severity: input.severity ?? null,
      details: {
        urgency: guidance.urgency,
        mode: guidance.mode,
        basis: guidance.basis,
        assessed_by_ai: analysis !== null,
        explained: explanation !== null,
        possible_conditions: explanation?.conditions.map((c) => c.name) ?? [],
      },
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("Could not save patient report.", error?.message);
  } else {
    reportId = data.id;
    await recordAuditEvent(deps.supabase, {
      userId: user.id,
      action: "patient.report_submitted",
      entity: "patient_report",
      entityId: data.id,
      metadata: { urgency: guidance.urgency, mode: guidance.mode, explained: explanation !== null },
    });
  }

  return { guidance, explanation, reportId, assessedByAi: analysis !== null };
}
