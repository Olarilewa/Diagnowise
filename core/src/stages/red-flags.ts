/**
 * Diagnowise core — Stage 3: red-flag detection.
 */

import { z } from "zod";
import type { ClinicalContext, NormalizedClinicalPicture, RedFlagFinding } from "../types.js";
import type { ModelProvider } from "../provider.js";
import { parseAndValidate } from "../json-utils.js";

const outputSchema = z.object({
  redFlags: z.array(
    z.object({
      label: z.string(),
      severity: z.enum(["info", "warning", "danger", "critical"]),
      why: z.string(),
      relevantDiagnoses: z.array(z.string()).default([]),
    })
  ),
});

const SYSTEM_PROMPT = `You are the red-flag detection stage inside Diagnowise, a diagnostic safety
tool for clinicians. Identify clinically important warning signs in the
presentation below — findings that, if present, should change how urgently
or how broadly this case is investigated.

Rules:
- Only flag findings actually present in the input. Do not invent findings.
- Use hedged, explanatory language in "why" (e.g. "raises concern for",
  "warrants evaluation of") — never state a diagnosis is confirmed.
- If there are no red flags, return an empty array. Do not manufacture one
  to seem thorough.

Respond with JSON only, matching exactly this shape:
{ "redFlags": [ { "label": string, "severity": "info"|"warning"|"danger"|"critical", "why": string, "relevantDiagnoses": string[] } ] }`;

function buildUserPrompt(context: ClinicalContext, normalized: NormalizedClinicalPicture): string {
  return `Patient: ${context.patient.age}-year-old ${context.patient.sex}.
Presenting complaint: "${context.presentingComplaint}"
Detected findings: ${normalized.detectedFindings.join(", ")}
Chronicity: ${normalized.chronicity}${normalized.durationSummary ? ` (${normalized.durationSummary})` : ""}
History:
${context.history.map((h) => `- ${h.label}: ${h.value}`).join("\n")}`;
}

export async function runRedFlagDetection(
  provider: ModelProvider,
  context: ClinicalContext,
  normalized: NormalizedClinicalPicture
): Promise<{ output: RedFlagFinding[]; model: string; rawInput: unknown }> {
  const userPrompt = buildUserPrompt(context, normalized);
  const result = await provider.complete({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 1024 });
  const parsed = parseAndValidate(result.text, outputSchema);
  return { output: parsed.redFlags, model: result.model, rawInput: { context, normalized } };
}
