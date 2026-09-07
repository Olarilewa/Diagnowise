/**
 * Diagnowise core — Stage 9: investigation considerations.
 *
 * Organized by purpose, not just listed (build doc §20) — and framed
 * throughout as clinician-facing considerations, never as autonomous orders
 * (build doc §20: "The AI must never present them as autonomous orders.").
 */

import { z } from "zod";
import type { ClinicalContext, DifferentialItem, InvestigationSuggestion } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  investigations: z
    .array(
      z.object({
        purpose: z.string(),
        items: z.array(z.string()).min(1),
      })
    )
    .max(4),
});

const SYSTEM_PROMPT = `You are the investigations stage inside Diagnowise. Suggest investigations
for clinician review, organized by WHY each one would help — not a flat
list.

Rules:
- Group by purpose, e.g. "To evaluate the current working diagnosis", "To
  distinguish between competing diagnoses", "To evaluate a potentially
  serious alternative". Use whichever purposes actually apply here.
- These are considerations for the clinician to review and order at their
  discretion — never phrase them as instructions already carried out.
- Keep it focused: at most 4 purpose groups, at most 3 items per group.

Respond with JSON only: { "investigations": [ { "purpose": string, "items": string[] } ] }`;

function buildUserPrompt(context: ClinicalContext, differential: DifferentialItem[]): string {
  return `Presenting complaint: "${context.presentingComplaint}"
${context.workingDiagnosis ? `Working diagnosis: ${context.workingDiagnosis}` : ""}
Differential:
${differential.map((d) => `- ${d.name} (${d.likelihood}${d.dangerous ? ", dangerous — should not be missed" : ""})`).join("\n")}`;
}

export async function runInvestigationConsiderations(
  provider: ModelProvider,
  context: ClinicalContext,
  differential: DifferentialItem[]
): Promise<{ output: InvestigationSuggestion[]; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, differential);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 768 });
  const parsed = parseAndValidate(result.text, outputSchema);
  return { output: parsed.investigations, model: result.model, rawInput: { context, differential } };
}
