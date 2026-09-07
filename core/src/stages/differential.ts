/**
 * Diagnowise core — Stage 4+5+6: differential generation, evidence mapping,
 * dangerous-diagnosis detection.
 *
 * Deliberately one model call, not three. Generating a differential without
 * its evidence isn't a usable intermediate result, and evidence mapping
 * only makes sense against a specific differential item — splitting these
 * into separate calls would mean re-sending the same context three times
 * for no safety or auditability benefit (strategy doc §13: "do not blindly
 * call multiple models for every request"). They're combined here as one
 * stage but still logged, audited, and independently swappable as a unit —
 * that's what the spec's "stage" boundary is actually protecting.
 */

import { z } from "zod";
import type { ClinicalContext, DifferentialItem, NormalizedClinicalPicture, RedFlagFinding } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const differentialItemSchema = z.object({
  name: z.string(),
  likelihood: z.enum(["low", "moderate", "high"]),
  dangerous: z.boolean(),
  why: z.string().optional(),
  supportingEvidence: z.array(z.string()).default([]),
  contradictingEvidence: z.array(z.string()).default([]),
  wouldIncreaseSuspicion: z.array(z.string()).default([]),
  wouldDecreaseSuspicion: z.array(z.string()).default([]),
});

const outputSchema = z.object({
  differential: z.array(differentialItemSchema).min(1),
});

const SYSTEM_PROMPT = `You are the differential-diagnosis stage inside Diagnowise, a diagnostic
safety tool for clinicians. Generate a differential diagnosis for the
presentation below.

Rules:
- Include at least one "dangerous" item — a diagnosis that must not be
  missed given this presentation — even if its likelihood is "low". If
  nothing serious plausibly applies, you may set dangerous=false on all
  items, but state your reasoning for why nothing dangerous applies in the
  "why" field of the most severe item you considered and ruled out.
- Every "dangerous" item MUST have a non-empty "why" explaining what about
  this presentation makes it something that shouldn't be missed.
- supportingEvidence and contradictingEvidence must cite only information
  actually present in the input below — never invent findings, test
  results, or history that wasn't given to you.
- likelihood reflects how likely each item is GIVEN CURRENT INFORMATION,
  not a claim about the eventual diagnosis. Never claim certainty.
- This is clinical decision support, not an autonomous diagnosis. The
  clinician reviews and confirms every item.

Respond with JSON only, matching exactly this shape:
{ "differential": [ { "name": string, "likelihood": "low"|"moderate"|"high", "dangerous": boolean, "why": string, "supportingEvidence": string[], "contradictingEvidence": string[], "wouldIncreaseSuspicion": string[], "wouldDecreaseSuspicion": string[] } ] }`;

function buildUserPrompt(context: ClinicalContext, normalized: NormalizedClinicalPicture, redFlags: RedFlagFinding[]): string {
  return `Patient: ${context.patient.age}-year-old ${context.patient.sex}.
Presenting complaint: "${context.presentingComplaint}"
Detected findings: ${normalized.detectedFindings.join(", ")}
Chronicity: ${normalized.chronicity}${normalized.durationSummary ? ` (${normalized.durationSummary})` : ""}
History:
${context.history.map((h) => `- ${h.label}: ${h.value}`).join("\n")}
Red flags already identified: ${redFlags.length ? redFlags.map((f) => f.label).join(", ") : "none"}
${context.workingDiagnosis ? `Clinician's current working diagnosis: ${context.workingDiagnosis}` : ""}`;
}

export async function runDifferentialGeneration(
  provider: ModelProvider,
  context: ClinicalContext,
  normalized: NormalizedClinicalPicture,
  redFlags: RedFlagFinding[]
): Promise<{ output: DifferentialItem[]; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, normalized, redFlags);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 2048 });
  const parsed = parseAndValidate(result.text, outputSchema);

  // Defense in depth beyond the schema: a dangerous item without a "why"
  // passed Zod (why is optional in the schema to allow non-dangerous items
  // to omit it) but violates the stage's own stated rule. Fail loudly
  // rather than silently show a clinician an unexplained danger flag.
  const unexplainedDanger = parsed.differential.find((d) => d.dangerous && !d.why?.trim());
  if (unexplainedDanger) {
    throw new Error(
      `Differential stage flagged "${unexplainedDanger.name}" as dangerous without an explanation — refusing to return unexplained danger flags.`
    );
  }

  return { output: parsed.differential, model: result.model, rawInput: { context, normalized, redFlags } };
}
