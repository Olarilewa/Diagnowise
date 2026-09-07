/**
 * Diagnowise core — optional safety-verification pass.
 *
 * Strategy doc §13 names "Model C: Safety checking" as a distinct role a
 * second model could play, separate from differential reasoning — and
 * immediately follows with "do not blindly call multiple models for every
 * request." This stage is how the orchestrator supports that without
 * defaulting to it: it's a pluggable, independently-configurable second
 * opinion on dangerous-diagnosis coverage specifically, run only when the
 * caller opts in (see orchestrator.ts's `runSafetyVerification` option).
 *
 * Designed to be run with a DIFFERENT provider/model than the differential
 * stage when configured that way — the orchestrator, not this file, decides
 * which provider instance to hand it.
 */

import { z } from "zod";
import type { ClinicalContext, DifferentialItem, SafetyVerificationResult } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  concernsRaised: z.boolean(),
  additionalDangerousConsiderations: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a second-opinion safety reviewer inside Diagnowise. You are given a
differential diagnosis another process already generated. Your ONLY job is
to check: does this differential adequately cover dangerous diagnoses that
should not be missed given the presentation, or is something serious
plausibly absent from the list?

Rules:
- You are not re-deriving the whole differential. Only flag a gap if a
  specific, plausible, dangerous diagnosis is missing given the actual
  presentation described.
- If the differential's dangerous-diagnosis coverage looks reasonable,
  set concernsRaised=false. Do not manufacture a concern to seem thorough.

Respond with JSON only: { "concernsRaised": boolean, "additionalDangerousConsiderations": string[], "notes": string }`;

function buildUserPrompt(context: ClinicalContext, differential: DifferentialItem[]): string {
  return `Presenting complaint: "${context.presentingComplaint}"
Patient: ${context.patient.age}-year-old ${context.patient.sex}.
Differential already generated:
${differential.map((d) => `- ${d.name} (${d.likelihood}${d.dangerous ? ", flagged dangerous" : ""})`).join("\n")}`;
}

export async function runSafetyVerification(
  provider: ModelProvider,
  context: ClinicalContext,
  differential: DifferentialItem[]
): Promise<{ output: SafetyVerificationResult; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, differential);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 512 });
  const output = parseAndValidate(result.text, outputSchema);
  return { output, model: result.model, rawInput: { context, differential } };
}
