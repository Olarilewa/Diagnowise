/**
 * Diagnowise core — Stage 7: contradiction detection.
 *
 * Only meaningful when there's a working diagnosis to check against — the
 * orchestrator skips calling this stage entirely if context.workingDiagnosis
 * is unset, rather than asking the model to contradict nothing.
 */

import { z } from "zod";
import type { ClinicalContext, ContradictionAssessment, DifferentialItem, NormalizedClinicalPicture, RedFlagFinding } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  hasContradiction: z.boolean(),
  summary: z.string().optional(),
  inconsistencies: z.array(z.string()).default([]),
});

const SYSTEM_PROMPT = `You are the diagnostic-contradiction stage inside Diagnowise. Your job is
to check whether the CURRENT WORKING DIAGNOSIS fully explains everything in
the clinical picture below, or whether something doesn't fit.

Rules:
- Set hasContradiction=true only if there is a genuine, specific mismatch
  (e.g. a red flag or finding the working diagnosis doesn't account for,
  or a lack of expected treatment response).
- If hasContradiction=true, summary and inconsistencies are required and
  must be specific — never a vague "consider reviewing this case."
- If the working diagnosis reasonably explains the picture, set
  hasContradiction=false and leave summary/inconsistencies empty. Do not
  manufacture doubt to seem thorough.
- This is a prompt for clinician reconsideration, not a claim that the
  working diagnosis is wrong.

Respond with JSON only: { "hasContradiction": boolean, "summary": string, "inconsistencies": string[] }`;

function buildUserPrompt(
  context: ClinicalContext,
  normalized: NormalizedClinicalPicture,
  redFlags: RedFlagFinding[],
  differential: DifferentialItem[]
): string {
  const working = differential.find((d) => d.name === context.workingDiagnosis);
  return `Working diagnosis: ${context.workingDiagnosis}
${working ? `Supporting evidence already noted: ${working.supportingEvidence.join("; ") || "none"}` : ""}
${working ? `Contradicting evidence already noted: ${working.contradictingEvidence.join("; ") || "none"}` : ""}
Full clinical picture — detected findings: ${normalized.detectedFindings.join(", ")}
Chronicity: ${normalized.chronicity}${normalized.durationSummary ? ` (${normalized.durationSummary})` : ""}
History:
${context.history.map((h) => `- ${h.label}: ${h.value}`).join("\n")}
Red flags present: ${redFlags.length ? redFlags.map((f) => f.label).join(", ") : "none"}`;
}

export async function runContradictionDetection(
  provider: ModelProvider,
  context: ClinicalContext,
  normalized: NormalizedClinicalPicture,
  redFlags: RedFlagFinding[],
  differential: DifferentialItem[]
): Promise<{ output: ContradictionAssessment; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, normalized, redFlags, differential);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 768 });
  const output = parseAndValidate(result.text, outputSchema);
  return { output, model: result.model, rawInput: { context, normalized, redFlags, differential } };
}
