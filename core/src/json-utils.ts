/**
 * Diagnowise core — strict JSON extraction.
 *
 * Every stage instructs its model to respond with JSON only. Models
 * sometimes wrap that in a markdown code fence anyway, or add a stray
 * sentence before/after — this strips the common cases and then validates
 * against the stage's Zod schema. If it still doesn't parse or validate,
 * this throws rather than silently returning a partial/guessed shape:
 * build doc §28 says never conceal uncertainty, and silently coercing a
 * malformed model response into "something shaped roughly right" is a form
 * of concealing it.
 */

import type { z } from "zod";

export class StageOutputParseError extends Error {
  constructor(message: string, public readonly rawText: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StageOutputParseError";
  }
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fenced?.[1];
  return (inner ?? text).trim();
}

/**
 * `z.ZodType<T, any, any>` rather than the `ZodSchema<T>` alias — the alias
 * loses precision across this function's generic boundary and silently
 * widens fields that use `.default(...)` back to `T | undefined`, which
 * defeats the purpose of declaring them required in types.ts. Verified
 * with an isolated repro before fixing it this way, not guessed.
 */
export function parseAndValidate<T>(rawText: string, schema: z.ZodType<T, any, any>): T {
  const candidate = stripCodeFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new StageOutputParseError("Model response was not valid JSON.", rawText, err);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new StageOutputParseError(
      `Model response did not match the expected shape: ${result.error.message}`,
      rawText,
      result.error
    );
  }
  return result.data;
}
