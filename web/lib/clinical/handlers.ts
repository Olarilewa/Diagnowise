/**
 * Diagnowise web — /clinical/* API handlers.
 *
 * Plain, testable functions — no NextRequest/NextResponse here. Each
 * app/api/clinical/*\/route.ts file is a thin wrapper that parses the
 * request, builds a Supabase client, calls one of these, and maps the
 * result through lib/utilities/route-helpers.ts. Keeping the logic here
 * means it can be unit-tested with a mocked Supabase client and a mocked
 * orchestrator, without booting a Next.js server.
 *
 * Stateful (/clinical/analyze, /clinical/explain) vs. stateless (the other
 * five) is the core design split — see this file's individual handlers and
 * lib/ai/orchestrator.ts's docstring on createStatelessOrchestrator for why.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalContext, ReasoningOrchestrator } from "@diagnowise/core";
import type { Database } from "@/types/database";
import { recordAuditEvent, requireAuth, requireCaseAccess } from "@/lib/security/auth";
import { NotFoundError } from "@/lib/utilities/errors";
import {
  analyzeCaseRequestSchema,
  clinicalContextInputSchema,
  contradictionsRequestSchema,
  explainRequestSchema,
  validateBody,
} from "@/lib/validation/schemas";
import { collectSafetyWarnings, createOrchestrator, createStatelessOrchestrator } from "@/lib/ai/orchestrator";
import { persistCaseAnalysis } from "@/lib/clinical/persist-analysis";

export interface ClinicalDeps {
  supabase: SupabaseClient<Database>;
  /** Injectable for tests; defaults to createStatelessOrchestrator() in production. */
  statelessOrchestratorFactory?: () => ReasoningOrchestrator;
  /** Injectable for tests; defaults to createOrchestrator(supabase) in production. */
  statefulOrchestratorFactory?: (supabase: SupabaseClient<Database>) => ReasoningOrchestrator;
}

function statelessOrchestrator(deps: ClinicalDeps): ReasoningOrchestrator {
  return (deps.statelessOrchestratorFactory ?? createStatelessOrchestrator)();
}

function statefulOrchestrator(deps: ClinicalDeps): ReasoningOrchestrator {
  return (deps.statefulOrchestratorFactory ?? createOrchestrator)(deps.supabase);
}

function toClinicalContext(caseId: string, body: ReturnType<typeof clinicalContextInputSchema.parse>): ClinicalContext {
  return {
    caseId,
    patient: body.patient,
    presentingComplaint: body.presentingComplaint,
    history: body.history,
    workingDiagnosis: body.workingDiagnosis,
  };
}

/**
 * Builds a ClinicalContext from an existing case's stored data — used only
 * by the stateful /clinical/analyze endpoint. Symptoms already recorded
 * against the case become its `history`.
 */
async function buildContextFromCase(supabase: SupabaseClient<Database>, caseId: string): Promise<ClinicalContext> {
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("presenting_complaint, working_diagnosis, patients(age, sex)")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) throw new NotFoundError("Case");

  const patient = caseRow.patients as unknown as { age: number | null; sex: Database["public"]["Tables"]["patients"]["Row"]["sex"] } | null;

  const { data: symptomRows } = await supabase.from("symptoms").select("name, onset, duration, source").eq("case_id", caseId);
  const history = (symptomRows ?? []).map((s) => ({
    label: s.name,
    value: [s.onset, s.duration].filter(Boolean).join(", ") || "present",
    source: (s.source === "patient" ? "patient" : "clinician") as "patient" | "clinician",
  }));

  return {
    caseId,
    patient: { age: patient?.age ?? 0, sex: patient?.sex ?? "unspecified" },
    presentingComplaint: caseRow.presenting_complaint ?? "",
    history,
    workingDiagnosis: caseRow.working_diagnosis ?? undefined,
  };
}

/* ============================================================
   Stateful: /clinical/analyze
   ============================================================ */

export async function handleAnalyzeCase(deps: ClinicalDeps, rawBody: unknown) {
  const body = validateBody(analyzeCaseRequestSchema, rawBody);
  const user = await requireCaseAccess(deps.supabase, body.caseId);
  const context = await buildContextFromCase(deps.supabase, body.caseId);

  const orchestrator = statefulOrchestrator(deps);
  const outcome = await orchestrator.runFullAnalysis(context, { runSafetyVerification: body.runSafetyVerification });

  const persisted = await persistCaseAnalysis(deps.supabase, body.caseId, outcome.result);
  await recordAuditEvent(deps.supabase, {
    userId: user.id,
    action: "case.analyzed",
    entity: "case",
    entityId: body.caseId,
    metadata: { differentialCount: outcome.result.differential.length, redFlagCount: outcome.result.redFlags.length },
  });

  return { analysis: outcome.result, safetyWarnings: outcome.safetyWarnings, persisted };
}

/* ============================================================
   Stateful: /clinical/explain
   ============================================================ */

export async function handleExplainRequest(deps: ClinicalDeps, rawBody: unknown) {
  const body = validateBody(explainRequestSchema, rawBody);
  await requireCaseAccess(deps.supabase, body.caseId);

  const { data, error } = await deps.supabase
    .from("ai_interactions")
    .select("model, stage, input, output, created_at")
    .eq("case_id", body.caseId)
    .eq("stage", body.stage)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch AI interaction: ${error.message}`);
  if (!data) throw new NotFoundError(`AI interaction for case ${body.caseId} at stage ${body.stage}`);

  return { model: data.model, stage: data.stage, input: data.input, output: data.output, generatedAt: data.created_at };
}

/* ============================================================
   Stateless capability endpoints
   ============================================================ */

export async function handleDifferentialRequest(deps: ClinicalDeps, rawBody: unknown) {
  await requireAuth(deps.supabase);
  const body = validateBody(clinicalContextInputSchema, rawBody);
  const context = toClinicalContext(`stateless-${randomUUID()}`, body);
  const orchestrator = statelessOrchestrator(deps);

  const normalized = await orchestrator.runNormalization(context);
  const redFlags = await orchestrator.runRedFlags(context, normalized.output);
  const differential = await orchestrator.runDifferential(context, normalized.output, redFlags.output);

  return {
    differential: differential.output,
    safetyWarnings: collectSafetyWarnings({
      extraction_normalization: normalized.violations,
      red_flag_detection: redFlags.violations,
      differential_generation: differential.violations,
    }),
  };
}

export async function handleRedFlagsRequest(deps: ClinicalDeps, rawBody: unknown) {
  await requireAuth(deps.supabase);
  const body = validateBody(clinicalContextInputSchema, rawBody);
  const context = toClinicalContext(`stateless-${randomUUID()}`, body);
  const orchestrator = statelessOrchestrator(deps);

  const normalized = await orchestrator.runNormalization(context);
  const redFlags = await orchestrator.runRedFlags(context, normalized.output);

  return {
    redFlags: redFlags.output,
    safetyWarnings: collectSafetyWarnings({ extraction_normalization: normalized.violations, red_flag_detection: redFlags.violations }),
  };
}

export async function handleMissingInformationRequest(deps: ClinicalDeps, rawBody: unknown) {
  await requireAuth(deps.supabase);
  const body = validateBody(clinicalContextInputSchema, rawBody);
  const context = toClinicalContext(`stateless-${randomUUID()}`, body);
  const orchestrator = statelessOrchestrator(deps);

  const normalized = await orchestrator.runNormalization(context);
  const redFlags = await orchestrator.runRedFlags(context, normalized.output);
  const differential = await orchestrator.runDifferential(context, normalized.output, redFlags.output);
  const missingInfo = await orchestrator.runMissingInformation(context, normalized.output, differential.output);

  return {
    missingInformation: missingInfo.output,
    safetyWarnings: collectSafetyWarnings({
      extraction_normalization: normalized.violations,
      red_flag_detection: redFlags.violations,
      differential_generation: differential.violations,
      missing_information_analysis: missingInfo.violations,
    }),
  };
}

export async function handleFollowUpRequest(deps: ClinicalDeps, rawBody: unknown) {
  await requireAuth(deps.supabase);
  const body = validateBody(clinicalContextInputSchema, rawBody);
  const context = toClinicalContext(`stateless-${randomUUID()}`, body);
  const orchestrator = statelessOrchestrator(deps);

  const normalized = await orchestrator.runNormalization(context);
  const redFlags = await orchestrator.runRedFlags(context, normalized.output);
  const differential = await orchestrator.runDifferential(context, normalized.output, redFlags.output);
  const followUp = await orchestrator.runFollowUp(context, differential.output, redFlags.output);

  return {
    followUp: followUp.output,
    safetyWarnings: collectSafetyWarnings({
      extraction_normalization: normalized.violations,
      red_flag_detection: redFlags.violations,
      differential_generation: differential.violations,
      follow_up_reasoning: followUp.violations,
    }),
  };
}

export async function handleContradictionsRequest(deps: ClinicalDeps, rawBody: unknown) {
  await requireAuth(deps.supabase);
  // A stricter schema than the shared one — workingDiagnosis is required
  // here, since there's nothing to check for contradictions against without it.
  const body = validateBody(contradictionsRequestSchema, rawBody);
  const context = toClinicalContext(`stateless-${randomUUID()}`, body);
  const orchestrator = statelessOrchestrator(deps);

  const normalized = await orchestrator.runNormalization(context);
  const redFlags = await orchestrator.runRedFlags(context, normalized.output);
  const differential = await orchestrator.runDifferential(context, normalized.output, redFlags.output);
  const contradiction = await orchestrator.runContradiction(context, normalized.output, redFlags.output, differential.output);

  return {
    contradiction: contradiction.output,
    safetyWarnings: collectSafetyWarnings({
      extraction_normalization: normalized.violations,
      red_flag_detection: redFlags.violations,
      differential_generation: differential.violations,
      contradiction_detection: contradiction.violations,
    }),
  };
}
