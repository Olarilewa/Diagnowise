/**
 * Diagnowise core — Stage 10: follow-up reasoning.
 */

import { z } from "zod";
import type { ClinicalContext, DifferentialItem, FollowUpPlan, RedFlagFinding } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  expected: z.string(),
  dueInDays: z.number().int().min(1).max(90),
  ifImproving: z.string(),
  ifNotImproving: z.string(),
});

const SYSTEM_PROMPT = `You are the follow-up stage inside Diagnowise. Define what a reasonable
follow-up plan looks like for this case: what response would be expected,
when to check in, and — critically — what should happen if the expected
response doesn't occur (build doc §21: this is meant to trigger diagnostic
reconsideration, not let a case quietly go unreviewed).

Rules:
- dueInDays should be sooner (days, not weeks) if any red flag is present
  or any differential item is dangerous.
- ifNotImproving should be a concrete escalation (e.g. a specific
  investigation or referral), not "monitor closely."

Respond with JSON only: { "expected": string, "dueInDays": number, "ifImproving": string, "ifNotImproving": string }`;

function buildUserPrompt(context: ClinicalContext, differential: DifferentialItem[], redFlags: RedFlagFinding[]): string {
  return `${context.workingDiagnosis ? `Working diagnosis: ${context.workingDiagnosis}` : "No working diagnosis yet."}
Dangerous differential items: ${differential.filter((d) => d.dangerous).map((d) => d.name).join(", ") || "none"}
Red flags present: ${redFlags.map((f) => f.label).join(", ") || "none"}`;
}

export async function runFollowUpReasoning(
  provider: ModelProvider,
  context: ClinicalContext,
  differential: DifferentialItem[],
  redFlags: RedFlagFinding[]
): Promise<{ output: FollowUpPlan; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, differential, redFlags);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 512 });
  const output = parseAndValidate(result.text, outputSchema);
  return { output, model: result.model, rawInput: { context, differential, redFlags } };
}
