/**
 * Diagnowise web — AI orchestration entry point.
 *
 * This is the function phase 3's route handlers (app/api/clinical/*) will
 * call. It does three things intentionally kept separate elsewhere in the
 * codebase: resolves which provider to use (env-driven, so swapping models
 * is a config change, never a code change), builds the ClinicalContext from
 * whatever the caller already has, and runs the full pipeline with a
 * Supabase-backed audit trail wired in.
 *
 * Nothing here persists the analysis result into diagnoses/red_flags/
 * contradictions — that mapping is web/lib/clinical/'s job (phase 3), kept
 * separate so this file's only responsibility is "run the reasoning
 * pipeline and audit it," not "and also know the shape of every clinical table."
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NullLogger,
  ReasoningOrchestrator,
  resolveProviderMap,
  type ClinicalContext,
  type FullAnalysisOutcome,
  type GuardrailViolation,
  type PipelineStage,
} from "@diagnowise/core";
import type { Database } from "@/types/database";
import { SupabaseAiInteractionLogger } from "./logger";

/**
 * Provider selection is configuration, not code: AI_PROVIDER_DEFAULT and
 * optional per-stage AI_PROVIDER_<STAGE> variables (see
 * docs/AI_PROVIDER_ARCHITECTURE.md). With only ANTHROPIC_API_KEY set this
 * behaves exactly as before. Misconfiguration throws here, naming the
 * variable, rather than on the first patient case.
 */
function buildProviderMap() {
  return resolveProviderMap(process.env, {
    onFailover: (e) => console.warn(`AI provider failover: ${e.failedProvider} -> ${e.nextProvider}`),
  });
}

/**
 * Built fresh per-request (not module-level singleton) so the logger is
 * always bound to the requesting user's own RLS-scoped Supabase client —
 * sharing one orchestrator instance across requests would mean sharing one
 * user's database session across everyone's requests, which is exactly the
 * kind of cross-tenant bug the RLS work in phase 1 exists to prevent.
 */
export function createOrchestrator(supabase: SupabaseClient<Database>): ReasoningOrchestrator {
  const logger = new SupabaseAiInteractionLogger(supabase);
  return new ReasoningOrchestrator(buildProviderMap(), logger);
}

/**
 * For the stateless capability endpoints (/clinical/differential,
 * /clinical/red-flags, /clinical/missing-information, /clinical/follow-up,
 * /clinical/contradictions) — there is no case to log against
 * (ai_interactions.case_id is a required foreign key), so these use
 * core's NullLogger instead of a database write.
 *
 * This is a deliberate MVP boundary, not an oversight: it means calls to
 * the stateless endpoints don't get a persisted Diagnowise-side audit
 * trail. Guardrail checking still runs regardless (it's independent of
 * logging inside the orchestrator) and every violation is returned
 * directly in the API response, so a caller isn't losing safety
 * information — just server-side persistence of it. A true external-API
 * audit trail (a table not foreign-keyed to `cases`) is real, separate
 * work — see docs/ARCHITECTURE.md.
 */
export function createStatelessOrchestrator(): ReasoningOrchestrator {
  return new ReasoningOrchestrator(buildProviderMap(), new NullLogger());
}

/** Builds the `safetyWarnings` shape every /clinical/* response includes, from whichever stages actually ran. */
export function collectSafetyWarnings(
  entries: Partial<Record<PipelineStage, GuardrailViolation[]>>
): Partial<Record<PipelineStage, GuardrailViolation[]>> {
  const warnings: Partial<Record<PipelineStage, GuardrailViolation[]>> = {};
  for (const [stage, violations] of Object.entries(entries)) {
    if (violations && violations.length > 0) warnings[stage as PipelineStage] = violations;
  }
  return warnings;
}

export interface RunCaseAnalysisInput {
  caseId: string;
  patient: { age: number; sex: "male" | "female" | "other" | "unspecified" };
  presentingComplaint: string;
  history: { label: string; value: string; source: "patient" | "clinician" }[];
  workingDiagnosis?: string;
}

/**
 * The single function `/clinical/analyze` (and the New Case intake flow's
 * "Analyze Case" step, and the "Re-run diagnostic analysis" reconsideration
 * flow already built into the frontend prototype) calls. Everything
 * upstream of this — building the ClinicalContext from a case ID, an
 * intake form, or clarifying-question answers — is the caller's job.
 */
export async function runCaseAnalysis(
  supabase: SupabaseClient<Database>,
  input: RunCaseAnalysisInput,
  options: { runSafetyVerification?: boolean } = {}
): Promise<FullAnalysisOutcome> {
  const orchestrator = createOrchestrator(supabase);
  const context: ClinicalContext = {
    caseId: input.caseId,
    patient: input.patient,
    presentingComplaint: input.presentingComplaint,
    history: input.history,
    workingDiagnosis: input.workingDiagnosis,
  };
  return orchestrator.runFullAnalysis(context, options);
}
