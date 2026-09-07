/**
 * Diagnowise core — Stage 1+2: extraction & normalization.
 *
 * Turns the raw presenting complaint into a structured picture: what
 * findings are present, how long they've lasted, whether the pattern is
 * acute/recurrent/chronic. This is the foundation every later stage reads
 * from — it does not itself generate any diagnosis or clinical judgment.
 */

import { z } from "zod";
import type { ClinicalContext, NormalizedClinicalPicture } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  detectedFindings: z.array(z.string()).min(1),
  chronicity: z.enum(["acute", "recurrent", "chronic", "unknown"]),
  durationSummary: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a clinical information extraction assistant inside Diagnowise, a
diagnostic safety tool. Your only job at this stage is to extract and
normalize findings from a presenting complaint — you do not diagnose
anything or express any clinical judgment at this stage.

Respond with JSON only, matching exactly this shape, and nothing else:
{
  "detectedFindings": string[],   // short noun phrases, e.g. "Abdominal pain", "Weight loss"
  "chronicity": "acute" | "recurrent" | "chronic" | "unknown",
  "durationSummary": string       // optional, e.g. "~4 months"
}`;

function buildUserPrompt(context: ClinicalContext): string {
  const historyLines = context.history.map((h) => `- ${h.label}: ${h.value} (${h.source}-reported)`).join("\n");
  return `Patient: ${context.patient.age}-year-old ${context.patient.sex}.
Presenting complaint: "${context.presentingComplaint}"
${historyLines ? `Additional history:\n${historyLines}` : ""}`;
}

export async function runExtractionNormalization(
  provider: ModelProvider,
  context: ClinicalContext
): Promise<{ output: NormalizedClinicalPicture; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 512 });
  const output = parseAndValidate(result.text, outputSchema);
  return { output, model: result.model, rawInput: { context } };
}
