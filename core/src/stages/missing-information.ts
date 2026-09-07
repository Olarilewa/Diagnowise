/**
 * Diagnowise core — Stage 8: missing-information analysis.
 */

import { z } from "zod";
import type { ClinicalContext, DifferentialItem, NormalizedClinicalPicture } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  missingInformation: z.array(z.string()).max(6),
});

const SYSTEM_PROMPT = `You are the missing-information stage inside Diagnowise. Identify the
highest-value questions that, if answered, could meaningfully change this
differential — not an exhaustive checklist.

Rules:
- Return at most 4 questions. Prioritize ruthlessly (build doc §15: "Do not
  ask 20 questions at once. Ask only the highest-value questions.").
- Each question should plausibly shift likelihood between two or more
  differential items, or help rule a dangerous item in or out.
- Phrase each as a direct, answerable clinical question.

Respond with JSON only: { "missingInformation": string[] }`;

function buildUserPrompt(context: ClinicalContext, normalized: NormalizedClinicalPicture, differential: DifferentialItem[]): string {
  return `Presenting complaint: "${context.presentingComplaint}"
Detected findings: ${normalized.detectedFindings.join(", ")}
Current differential:
${differential.map((d) => `- ${d.name} (${d.likelihood}${d.dangerous ? ", dangerous" : ""})`).join("\n")}
History already gathered:
${context.history.map((h) => `- ${h.label}: ${h.value}`).join("\n")}`;
}

export async function runMissingInformationAnalysis(
  provider: ModelProvider,
  context: ClinicalContext,
  normalized: NormalizedClinicalPicture,
  differential: DifferentialItem[]
): Promise<{ output: string[]; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, normalized, differential);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 512 });
  const parsed = parseAndValidate(result.text, outputSchema);
  return { output: parsed.missingInformation, model: result.model, rawInput: { context, normalized, differential } };
}
