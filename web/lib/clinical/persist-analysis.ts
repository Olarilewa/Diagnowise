/**
 * Diagnowise web — persisting analysis results.
 *
 * The one file that knows both `core/`'s CaseAnalysisResult shape AND the
 * clinical table shapes from the backend phase. Kept separate from
 * `lib/ai/` (which only knows how to run the pipeline and audit it) and
 * from `lib/database/` (pure data access with no clinical-domain
 * knowledge) — see this directory's original README for why.
 *
 * Writes through the caller's own RLS-scoped session throughout. Every
 * insert here targets a table whose RLS policy requires the caller to be
 * the case's assigned clinician (supabase/migrations/0003_rls_policies.sql),
 * so persisting on behalf of a case the caller doesn't own fails at the
 * database, not just at the application layer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseAnalysisResult } from "@diagnowise/core";
import type { Database } from "@/types/database";

export interface PersistCaseAnalysisResult {
  diagnosisIds: string[];
  redFlagIds: string[];
  contradictionId: string | null;
  investigationIds: string[];
  followUpId: string;
}

/**
 * Persists a full analysis result for a case. Does NOT touch
 * cases.working_diagnosis — the clinician confirms/sets that explicitly
 * (spec §45's trust model: AI proposes a differential, it doesn't get to
 * silently overwrite what the clinician has confirmed).
 */
export async function persistCaseAnalysis(
  supabase: SupabaseClient<Database>,
  caseId: string,
  result: CaseAnalysisResult
): Promise<PersistCaseAnalysisResult> {
  const { data: diagnosisRows, error: diagnosisError } = await supabase
    .from("diagnoses")
    .insert(
      result.differential.map((item) => ({
        case_id: caseId,
        diagnosis: item.name,
        category: (item.dangerous ? "dangerous" : "differential") as "dangerous" | "differential",
        likelihood: item.likelihood,
        reasoning: item.why ?? null,
        supporting_evidence: item.supportingEvidence,
        contradicting_evidence: item.contradictingEvidence,
        is_ai_generated: true,
      }))
    )
    .select("id");
  if (diagnosisError) throw new Error(`Failed to persist differential: ${diagnosisError.message}`);

  const { data: redFlagRows, error: redFlagError } = await supabase
    .from("red_flags")
    .insert(
      result.redFlags.map((flag) => ({
        case_id: caseId,
        finding: flag.label,
        severity: flag.severity,
        explanation: flag.why,
        relevant_diagnoses: flag.relevantDiagnoses,
      }))
    )
    .select("id");
  if (redFlagError) throw new Error(`Failed to persist red flags: ${redFlagError.message}`);

  let contradictionId: string | null = null;
  if (result.contradiction.hasContradiction) {
    const { data: contradictionRow, error: contradictionError } = await supabase
      .from("contradictions")
      .insert({
        case_id: caseId,
        summary: result.contradiction.summary ?? "",
        inconsistencies: result.contradiction.inconsistencies,
      })
      .select("id")
      .single();
    if (contradictionError) throw new Error(`Failed to persist contradiction: ${contradictionError.message}`);
    contradictionId = contradictionRow.id;

    const { error: reconsiderationEventError } = await supabase.from("case_timeline_events").insert({
      case_id: caseId,
      event: "Diagnostic reconsideration triggered",
      detail: result.contradiction.summary ?? null,
    });
    if (reconsiderationEventError) throw new Error(`Failed to persist timeline event: ${reconsiderationEventError.message}`);
  }

  const { data: investigationRows, error: investigationError } = await supabase
    .from("investigations")
    .insert(
      result.investigations.flatMap((group) =>
        group.items.map((item) => ({
          case_id: caseId,
          name: item,
          purpose: group.purpose,
          status: "suggested" as const,
        }))
      )
    )
    .select("id");
  if (investigationError) throw new Error(`Failed to persist investigations: ${investigationError.message}`);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + result.followUp.dueInDays);
  const { data: followUpRow, error: followUpError } = await supabase
    .from("follow_ups")
    .insert({
      case_id: caseId,
      due_date: dueDate.toISOString().slice(0, 10),
      expected_response: result.followUp.expected,
      status: "pending" as const,
    })
    .select("id")
    .single();
  if (followUpError) throw new Error(`Failed to persist follow-up: ${followUpError.message}`);

  const { error: completedEventError } = await supabase.from("case_timeline_events").insert({
    case_id: caseId,
    event: "Diagnostic analysis completed",
    detail: `${result.differential.length} differential item(s), ${result.redFlags.length} red flag(s) identified.`,
  });
  if (completedEventError) throw new Error(`Failed to persist timeline event: ${completedEventError.message}`);

  return {
    diagnosisIds: (diagnosisRows ?? []).map((r) => r.id),
    redFlagIds: (redFlagRows ?? []).map((r) => r.id),
    contradictionId,
    investigationIds: (investigationRows ?? []).map((r) => r.id),
    followUpId: followUpRow.id,
  };
}
