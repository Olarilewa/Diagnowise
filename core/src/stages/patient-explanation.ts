/**
 * Diagnowise core — patient explanation stage.
 *
 * Validation failure is thrown as StageOutputParseError on purpose: the orchestrator
 * retries a stage once on exactly that error, and after the second failure it gives up
 * and throws, so the caller shows the patient nothing from the model.
 */

import type { ClinicalContext, DifferentialItem, NormalizedClinicalPicture, RedFlagFinding } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate, StageOutputParseError } from "../json-utils.js";
import {
  EXPLANATION_SYSTEM_PROMPT,
  buildExplanationUserPrompt,
  modelOutputSchema,
  selectConditionsForPatient,
  validatePatientExplanation,
  type PatientExplanation,
} from "../patient-safety/explanation.js";

export async function runPatientExplanation(
  provider: ModelProvider,
  context: ClinicalContext,
  normalized: NormalizedClinicalPicture,
  redFlags: RedFlagFinding[],
  differential: DifferentialItem[]
): Promise<{ output: PatientExplanation; model: string; rawInput: unknown }> {
  const allowed = selectConditionsForPatient(differential);
  if (allowed.length === 0) throw new Error("No conditions are suitable to show a patient.");

  const userPrompt = buildExplanationUserPrompt({
    presentingComplaint: context.presentingComplaint,
    age: context.patient.age,
    sex: context.patient.sex,
    detectedFindings: normalized.detectedFindings,
    redFlagLabels: redFlags.map((f) => f.label),
    allowed,
  });
  const result = await provider.complete({ systemPrompt: EXPLANATION_SYSTEM_PROMPT, userPrompt, maxTokens: 2200 });
  const parsed = parseAndValidate(result.text, modelOutputSchema);
  const checked = validatePatientExplanation(parsed, allowed);
  if (!checked.ok) {
    throw new StageOutputParseError(`Patient explanation failed safety validation: ${checked.reasons.join(", ")}.`, result.text);
  }
  return { output: checked.explanation, model: result.model, rawInput: { allowed: allowed.map((d) => d.name) } };
}
