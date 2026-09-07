import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOvercertainLanguage, checkStructuredOutputForOvercertainty } from "../src/safety/guardrails.js";

test("guardrails: catches 'you have X' framing", () => {
  const violations = checkOvercertainLanguage("Based on these symptoms, you have gastritis.");
  assert.ok(violations.some((v) => v.phrase === "diagnostic certainty claim"));
});

test("guardrails: catches absolute certainty words", () => {
  for (const phrase of ["This is definitely a peptic ulcer.", "The patient certainly has gastritis.", "Undoubtedly a case of migraine."]) {
    const violations = checkOvercertainLanguage(phrase);
    assert.ok(violations.length > 0, `expected a violation for: "${phrase}"`);
  }
});

test("guardrails: catches numeric false-precision certainty", () => {
  const violations = checkOvercertainLanguage("We are 100% certain this is the diagnosis.");
  assert.ok(violations.some((v) => v.phrase === "numeric false-precision certainty"));
});

test("guardrails: catches 'AI diagnosis' framing", () => {
  const violations = checkOvercertainLanguage("The AI diagnosis is peptic ulcer disease.");
  assert.ok(violations.some((v) => v.phrase === "autonomous authority framing"));
});

test("guardrails: does NOT flag properly hedged clinical language", () => {
  const clean = [
    "Gastric malignancy should be considered given the persistent symptoms.",
    "This finding may indicate an underlying structural cause.",
    "Further evaluation is warranted before ruling this out.",
    "This is one of several possibilities that would explain the presentation.",
  ];
  for (const phrase of clean) {
    const violations = checkOvercertainLanguage(phrase);
    assert.deepEqual(violations, [], `expected no violations for properly hedged text: "${phrase}"`);
  }
});

test("guardrails: recursively scans nested structured output", () => {
  const output = {
    differential: [
      { name: "Gastritis", why: "You definitely have this." },
      { name: "Gastric malignancy", why: "Should be considered given risk factors." },
    ],
  };
  const violations = checkStructuredOutputForOvercertainty(output);
  // "You definitely have this" legitimately trips two separate rules
  // (the "you have" framing AND the "definitely" certainty word) —
  // asserting >0 rather than an exact count so this test doesn't become
  // brittle to the guardrail correctly getting stricter over time.
  assert.ok(violations.length > 0);
  assert.ok(violations.every((v) => v.match !== "Should be considered given risk factors."));
});

test("guardrails: clean structured output produces zero violations", () => {
  const output = {
    redFlags: [{ label: "Weight loss", why: "Raises concern for a structural or malignant process." }],
  };
  assert.deepEqual(checkStructuredOutputForOvercertainty(output), []);
});
