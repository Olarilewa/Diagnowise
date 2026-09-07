/**
 * Diagnowise — validation schemas
 *
 * Every write that crosses an API boundary (phase 3) is validated against
 * one of these before it touches the database — RLS controls *who* can
 * write, this controls *what shape* they're allowed to write (spec §31:
 * "input validation" as an explicit requirement).
 */

import { z } from "zod";
import { ValidationError } from "@/lib/utilities/errors";

export const sexSchema = z.enum(["male", "female", "other", "unspecified"]);
export const riskLevelSchema = z.enum(["low", "moderate", "high", "critical"]);
export const caseStatusSchema = z.enum([
  "draft",
  "active",
  "awaiting_investigation",
  "awaiting_followup",
  "reassessment_required",
  "resolved",
  "archived",
]);
export const evidenceSourceSchema = z.enum(["patient", "clinician", "ai", "system"]);
export const diagnosisCategorySchema = z.enum(["working", "differential", "dangerous"]);
export const likelihoodSchema = z.enum(["low", "moderate", "high"]);
export const redFlagSeveritySchema = z.enum(["info", "warning", "danger", "critical"]);

/**
 * Matches the "Patient" step of the New Case intake flow. Intentionally
 * minimal — see patients table comment in 0001_init_schema.sql on avoiding
 * unnecessary PII.
 */
export const createPatientSchema = z.object({
  external_reference: z
    .string()
    .trim()
    .min(1, "A patient reference is required.")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and hyphens."),
  age: z.number().int().min(0).max(130).optional(),
  sex: sexSchema.optional(),
});

/**
 * Matches the "Presenting complaint" step. `complaint` is the free-text
 * input; extraction of `detected` chips happens client-side today and
 * server-side once the AI orchestration layer (phase 2) lands — accepting
 * client-supplied chips here is deliberately permissive since they're
 * always clinician-reviewable/editable per spec §14, never authoritative
 * on their own.
 */
export const createCaseSchema = z.object({
  patient_id: z.string().uuid(),
  setting: z.string().trim().max(120).optional(),
  presenting_complaint: z.string().trim().min(1, "Describe what brought the patient in.").max(4000),
});

export const updateCaseSchema = z.object({
  status: caseStatusSchema.optional(),
  risk_level: riskLevelSchema.optional(),
  working_diagnosis: z.string().trim().max(200).optional(),
});

/**
 * Matches the "AI clinical intake" clarifying-question answers (spec §15).
 * Kept generic (question id -> answer) rather than one field per possible
 * question, since the question set is template-driven and will grow.
 */
export const clarifyingAnswersSchema = z.record(z.string(), z.enum(["yes", "no", "unsure"]));

export const createSymptomSchema = z.object({
  case_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  onset: z.string().trim().max(120).optional(),
  duration: z.string().trim().max(120).optional(),
  severity: z.string().trim().max(60).optional(),
  source: evidenceSourceSchema.default("clinician"),
});

export const createDiagnosisSchema = z.object({
  case_id: z.string().uuid(),
  diagnosis: z.string().trim().min(1).max(200),
  category: diagnosisCategorySchema,
  likelihood: likelihoodSchema.optional(),
  reasoning: z.string().trim().max(2000).optional(),
  supporting_evidence: z.array(z.string().trim().max(400)).default([]),
  contradicting_evidence: z.array(z.string().trim().max(400)).default([]),
});

export const createRedFlagSchema = z.object({
  case_id: z.string().uuid(),
  finding: z.string().trim().min(1).max(200),
  severity: redFlagSeveritySchema.default("warning"),
  explanation: z.string().trim().max(1000).optional(),
  relevant_diagnoses: z.array(z.string().trim().max(200)).default([]),
});

export const createInvestigationSchema = z.object({
  case_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  purpose: z.string().trim().max(400).optional(),
});

export const createFollowUpSchema = z.object({
  case_id: z.string().uuid(),
  due_date: z.string().date().optional(),
  expected_response: z.string().trim().max(1000).optional(),
});

export const resolveFollowUpSchema = z.object({
  outcome: z.enum(["better", "same", "worse"]),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type ClarifyingAnswersInput = z.infer<typeof clarifyingAnswersSchema>;

/**
 * Validates a schema and throws our own ValidationError (422, with the
 * flattened Zod issues attached) rather than letting a raw ZodError escape
 * a route handler — keeps every API error going through the same
 * toErrorResponse() mapping in lib/utilities/errors.ts.
 *
 * `z.ZodType<T, any, any>` rather than the `ZodSchema<T>` alias — see
 * core/src/json-utils.ts's docstring for why: the alias silently widens
 * fields using `.default(...)` back to `T | undefined` across a generic
 * function boundary under strictNullChecks. Verified with an isolated
 * repro before fixing it that way there; applying the same fix here rather
 * than rediscovering the same bug twice.
 */
export function validateBody<T>(schema: z.ZodType<T, any, any>, rawBody: unknown): T {
  const result = schema.safeParse(rawBody);
  if (!result.success) {
    throw new ValidationError("Request body did not match the expected shape.", result.error.flatten());
  }
  return result.data;
}

/* ============================================================
   Phase 3 — /clinical/* API request schemas
   ============================================================ */

export const clinicalHistoryEntrySchema = z.object({
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(500),
  source: z.enum(["patient", "clinician"]),
});

/**
 * Shared shape for the stateless capability endpoints (differential,
 * red-flags, missing-information, follow-up) — these don't require a
 * Diagnowise case to exist, matching strategy doc §11's "other healthcare
 * applications should be able to use Diagnowise's clinical reasoning
 * without using the Diagnowise interface."
 */
export const clinicalContextInputSchema = z.object({
  patient: z.object({
    age: z.number().int().min(0).max(130),
    sex: sexSchema,
  }),
  presentingComplaint: z.string().trim().min(1).max(4000),
  history: z.array(clinicalHistoryEntrySchema).max(20).default([]),
  workingDiagnosis: z.string().trim().max(200).optional(),
});

/** /clinical/contradictions specifically requires a working diagnosis to check against. */
export const contradictionsRequestSchema = clinicalContextInputSchema.extend({
  workingDiagnosis: z.string().trim().min(1, "A working diagnosis is required to check for contradictions.").max(200),
});

/** /clinical/analyze is stateful — it loads its own context from the case, so the request is just which case and how. */
export const analyzeCaseRequestSchema = z.object({
  caseId: z.string().uuid(),
  runSafetyVerification: z.boolean().optional(),
});

export const pipelineStageSchema = z.enum([
  "extraction_normalization",
  "red_flag_detection",
  "differential_generation",
  "contradiction_detection",
  "missing_information_analysis",
  "investigation_considerations",
  "follow_up_reasoning",
  "safety_verification",
]);

export const explainRequestSchema = z.object({
  caseId: z.string().uuid(),
  stage: pipelineStageSchema,
});
