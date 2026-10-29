/**
 * Diagnowise core — patient-facing explanation and possible diagnoses.
 *
 * PRODUCT DECISION (from the product owner): patients see possible diagnoses,
 * preceded by a detailed plain-language explanation of what might be going on,
 * with a disclaimer that this is only to help them understand and that they must
 * see a clinician before any treatment.
 *
 * This is the one place a patient can be shown named conditions, so it is the most
 * constrained code in the patient product:
 *
 *  - Only conditions from the pipeline's own differential may appear. The model
 *    cannot introduce a condition, and cannot downplay one: `canBeSerious` is taken
 *    from the differential's `dangerous` flag, never from the model.
 *  - The banner and the disclaimer are fixed text set by code. The model cannot
 *    edit, shorten or omit them.
 *  - Model text is checked before it can be shown: no reassurance, no ruling-out,
 *    no treatment, doses or home remedies, no statistics, no diagnostic certainty.
 *    ANY failure rejects the WHOLE explanation (it is never shown partially
 *    checked) and the patient simply gets the fixed-copy guidance instead.
 *  - Emergency and crisis text never reaches this stage (see web/lib/patient).
 *
 * LIMIT, stated plainly: unlike the fixed guidance copy, model-written text cannot be
 * enumerated and reviewed in advance, and a pattern denylist is a partial net, not a
 * proof. Review real sample outputs with clinicians before this is switched on.
 */

import { z } from "zod";
import { checkStructuredOutputForOvercertainty } from "../safety/guardrails.js";
import type { DifferentialItem } from "../types.js";

export const PATIENT_EXPLANATION_BANNER = "Possible explanations, not a diagnosis";

export const PATIENT_EXPLANATION_DISCLAIMER =
  "These are possible explanations, not a diagnosis. They are here only to help you understand what might be going on. " +
  "The list is not complete: other causes, including serious ones, are possible, and only a clinician who examines you can say what is wrong. " +
  "Please see a clinician before starting any treatment, and do not treat yourself based on this.";

export interface PatientCondition {
  name: string;
  whatItIs: string;
  whyItCouldFit: string[];
  whatMakesItLessLikely: string[];
  /** From the differential's `dangerous` flag. The model cannot change this. */
  canBeSerious: boolean;
}

export interface PatientExplanation {
  /** Shown FIRST: what might be going on, in plain language. */
  overview: string[];
  /** Shown after the overview, under the banner. */
  conditions: PatientCondition[];
  questionsToAsk: string[];
  banner: string;
  disclaimer: string;
}

export const MAX_PATIENT_CONDITIONS = 5;

const RANK: Record<string, number> = { high: 3, moderate: 2, low: 1 };
const rank = (d: DifferentialItem) => RANK[d.likelihood] ?? 1;

/**
 * Which differential items a patient may be shown. A dangerous condition is shown
 * only when it is at least moderately likely (a remote possibility would alarm without
 * informing; the disclaimer says the list is incomplete and urgency is driven separately
 * by red flags). Dangerous moderate/high items are never crowded out by safer ones.
 */
export function selectConditionsForPatient(differential: DifferentialItem[], max = MAX_PATIENT_CONDITIONS): DifferentialItem[] {
  const eligible = differential.filter((d) => !(d.dangerous && rank(d) < 2));
  const must = eligible.filter((d) => d.dangerous);
  const rest = eligible.filter((d) => !d.dangerous).sort((a, b) => rank(b) - rank(a));
  const chosen = new Set([...must, ...rest].slice(0, max));
  return eligible.filter((d) => chosen.has(d)).sort((a, b) => rank(b) - rank(a));
}

// ------------------------------------------------------------------ model I/O
export const modelOutputSchema = z.object({
  overview: z.array(z.string().trim().min(1).max(900)).min(1).max(5),
  conditions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        what_it_is: z.string().trim().min(1).max(700),
        why_it_could_fit: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
        what_makes_it_less_likely: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
      })
    )
    .min(1)
    .max(6),
  questions_to_ask: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

export const EXPLANATION_SYSTEM_PROMPT = `You write for a patient with no medical training who has described their symptoms.
Your job is to help them understand what MIGHT be going on, using ONLY the analysis you are given.

Write in plain, warm, calm language (aim for a reading age of about 12). Short sentences.

STRUCTURE
1. "overview": 2 to 4 short paragraphs explaining, in detail, what might be going on and why their symptoms could fit together. Say what the possibilities have in common and how they differ. Explain medical words you use.
2. "conditions": one entry for each condition in the list you are given, using the name EXACTLY as listed. For each: what it is, why it could fit what they described, and what makes it less likely.
3. "questions_to_ask": up to 5 questions the patient could ask a clinician.

HARD RULES (a reply that breaks any of these is thrown away unread)
- Only discuss the conditions in the list. Never add another condition.
- Use hedged words: may, might, could, possible. NEVER write the words "you have". Say "if there is a fever" instead of "if you have a fever".
- Never say a condition is harmless, benign, mild, not serious, or nothing to worry about. Never tell them not to worry. Never say anything is ruled out or can be excluded.
- Never give treatment: no medicines, doses, home remedies, creams, supplements, or "things to try". Do not tell them to start or stop anything.
- No numbers about how likely or common something is: no percentages, no "1 in 10".
- Do not say what the patient definitely has, and do not write as if you examined them.
- You may say a condition can be serious, and that a clinician needs to assess it.
- For any condition marked "can be serious", leave "what_makes_it_less_likely" empty.

Respond with JSON only, in exactly this shape:
{ "overview": string[], "conditions": [ { "name": string, "what_it_is": string, "why_it_could_fit": string[], "what_makes_it_less_likely": string[] } ], "questions_to_ask": string[] }`;

export function buildExplanationUserPrompt(input: {
  presentingComplaint: string;
  age: number;
  sex: string;
  detectedFindings: string[];
  redFlagLabels: string[];
  allowed: DifferentialItem[];
}): string {
  const list = input.allowed
    .map((d) => `- ${d.name} (${d.likelihood} relative likelihood${d.dangerous ? "; can be serious" : ""})\n  could fit because: ${d.supportingEvidence.join("; ") || "n/a"}\n  less likely because: ${d.contradictingEvidence.join("; ") || "n/a"}`)
    .join("\n");
  return `The patient (${input.age}-year-old, ${input.sex}) wrote: "${input.presentingComplaint}"
Findings picked out of that: ${input.detectedFindings.join(", ") || "none listed"}
Warning features noticed: ${input.redFlagLabels.join(", ") || "none"}

Only discuss these conditions (use these exact names):
${list}`;
}

// ------------------------------------------------------------------ validation
const RULES: { label: string; pattern: RegExp }[] = [
  { label: "reassurance", pattern: /\b(nothing to worry|nothing serious|no (need|cause|reason) (to|for) (worry|concern|alarm|see)|do ?n[o']t worry|not (a )?(serious|dangerous|harmful|worrying|concerning)|harmless|benign|innocent|perfectly (normal|fine|safe)|safe to ignore|can safely ignore|(go|goes|clear|clears|resolve|resolves) (away )?on (its|their) own|usually mild)\b/i },
  { label: "ruling out", pattern: /\b(rule[sd]?|ruled|ruling) (it |this |that |them |these )?out\b|\b(exclude[sd]?|excluding|dismiss(ed|es)?)\b/i },
  { label: "treatment or dosing", pattern: /\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|iu|tablets?|pills?|capsules?)\b|\b(dose|dosage|dosing)\b|\b(you should|you can|try to|consider|best to) (take|taking|use|using|apply|applying|drink|drinking|eat|eating)\b|\b(start|begin|stop|continue|avoid) (taking|using)\b|\b(ibuprofen|paracetamol|acetaminophen|aspirin|antibiotics?|painkillers?|steroids?|ointment|cream|home remed(y|ies)|self[- ]?treat\w*)\b/i },
  { label: "statistics", pattern: /\b\d{1,3}\s?(%|per ?cent)|\b(1|one) in \d+\b|\b\d+ (out of|in every) \d+\b/i },
  { label: "diagnostic certainty", pattern: /\byou (are|were) (suffering|diagnosed)\b|\bthis is (definitely|certainly|clearly|obviously|a case of)\b|\bit is (definitely|certainly|clearly|obviously)\b/i },
];

function allStrings(o: ModelOutput): string[] {
  return [...o.overview, ...o.questions_to_ask, ...o.conditions.flatMap((c) => [c.name, c.what_it_is, ...c.why_it_could_fit, ...c.what_makes_it_less_likely])];
}

export type ValidationResult = { ok: true; explanation: PatientExplanation } | { ok: false; reasons: string[] };

/** All-or-nothing: any failed rule rejects the entire explanation. */
export function validatePatientExplanation(output: ModelOutput, allowed: DifferentialItem[]): ValidationResult {
  const reasons: string[] = [];
  const text = allStrings(output);

  if (checkStructuredOutputForOvercertainty(text).length > 0) reasons.push("overcertain language");
  for (const rule of RULES) if (text.some((t) => rule.pattern.test(t))) reasons.push(rule.label);

  const byName = new Map(allowed.map((d) => [d.name.trim().toLowerCase(), d]));
  const seen = new Set<string>();
  const conditions: PatientCondition[] = [];
  for (const c of output.conditions) {
    const key = c.name.trim().toLowerCase();
    const source = byName.get(key);
    if (!source || seen.has(key)) continue; // unknown or repeated: dropped, never shown
    seen.add(key);
    // For a condition that can be serious, never show reasons it is "less likely": that is exactly where
    // false reassurance does harm. The model is told this, and the code enforces it regardless.
    conditions.push({ name: source.name, whatItIs: c.what_it_is, whyItCouldFit: c.why_it_could_fit, whatMakesItLessLikely: source.dangerous ? [] : c.what_makes_it_less_likely, canBeSerious: source.dangerous });
  }
  if (conditions.length === 0) reasons.push("no recognised conditions");

  // Serious possibilities must not be silently dropped by the model.
  for (const d of allowed) if (d.dangerous && !seen.has(d.name.trim().toLowerCase())) { reasons.push("omitted a serious possibility"); break; }

  if (reasons.length > 0) return { ok: false, reasons: [...new Set(reasons)] };
  const order = new Map(allowed.map((d, i) => [d.name, i]));
  conditions.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  return { ok: true, explanation: { overview: output.overview, conditions, questionsToAsk: output.questions_to_ask, banner: PATIENT_EXPLANATION_BANNER, disclaimer: PATIENT_EXPLANATION_DISCLAIMER } };
}
