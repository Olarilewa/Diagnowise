/**
 * Diagnowise core — overcertainty guardrail.
 *
 * Build doc §46 (Product Language) and §28 (AI Safety) are explicit: never
 * "you have X", never "definitely", "100%", "guaranteed", never present an
 * AI-generated diagnosis as confirmed. The prompts given to the model
 * already instruct it not to do this — but a prompt instruction is not a
 * guarantee, and this product's entire premise is not trusting AI output
 * blindly. This is the actual enforcement: a deterministic check run on
 * every piece of model-generated prose before it's considered safe to show
 * a clinician, independent of whether the model "listened."
 *
 * This does not try to be clever NLP — it's a denylist of phrasing patterns
 * that have no legitimate use in hedged clinical language, checked as a
 * fast, fully deterministic, fully testable pass. False negatives (a model
 * finding a new way to be overconfident that isn't on this list) are
 * expected over time; when that happens, the fix is adding a pattern here,
 * not trusting the model harder.
 */

export interface GuardrailViolation {
  phrase: string;
  match: string;
}

const FORBIDDEN_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "diagnostic certainty claim", pattern: /\byou (definitely |certainly )?have\b/i },
  { label: "absolute certainty language", pattern: /\b(definitely|certainly|undoubtedly|without a doubt)\b/i },
  { label: "numeric false-precision certainty", pattern: /\b100%\s*(certain|sure|confident)?\b/i },
  { label: "guarantee language", pattern: /\bguarantee(d|s)?\b/i },
  { label: "confirmed-diagnosis framing", pattern: /\b(confirmed|final) diagnosis is\b/i },
  { label: "autonomous authority framing", pattern: /\bAI diagnosis\b/i },
];

/**
 * Scans a single piece of AI-generated text for forbidden certainty
 * language. Returns an empty array if the text is clean.
 */
export function checkOvercertainLanguage(text: string): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({ phrase: label, match: match[0] });
    }
  }
  return violations;
}

/**
 * Scans every string field of a stage's structured output (recursively,
 * since output is nested JSON) rather than requiring each stage to
 * remember to call the single-string checker on every field it produces.
 */
export function checkStructuredOutputForOvercertainty(value: unknown): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === "string") {
      violations.push(...checkOvercertainLanguage(node));
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node && typeof node === "object") {
      Object.values(node).forEach(visit);
    }
  };
  visit(value);
  return violations;
}
