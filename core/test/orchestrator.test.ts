import { test } from "node:test";
import assert from "node:assert/strict";
import { ReasoningOrchestrator } from "../src/orchestrator.js";
import { MockProvider } from "../src/providers/mock.js";
import { InMemoryLogger } from "../src/logger.js";
import type { ClinicalContext } from "../src/types.js";

const GI_CASE: ClinicalContext = {
  caseId: "test-case-1",
  patient: { age: 48, sex: "male" },
  presentingComplaint: "Recurrent upper abdominal pain for four months with weight loss.",
  history: [
    { label: "Weight change", value: "-6kg over 3 months", source: "clinician" },
    { label: "Prior treatment", value: "8-week PPI course, minimal improvement", source: "clinician" },
  ],
  workingDiagnosis: "Peptic ulcer disease",
};

const NORMALIZED_RESPONSE = JSON.stringify({
  detectedFindings: ["Abdominal pain", "Weight loss"],
  chronicity: "chronic",
  durationSummary: "~4 months",
});

const RED_FLAGS_RESPONSE = JSON.stringify({
  redFlags: [
    { label: "Unintentional weight loss", severity: "danger", why: "Raises concern for a structural cause.", relevantDiagnoses: ["Gastric malignancy"] },
  ],
});

const DIFFERENTIAL_RESPONSE = JSON.stringify({
  differential: [
    {
      name: "Peptic ulcer disease",
      likelihood: "moderate",
      dangerous: false,
      supportingEvidence: ["Epigastric pain pattern"],
      contradictingEvidence: ["No improvement after PPI trial"],
      wouldIncreaseSuspicion: ["Endoscopic confirmation"],
      wouldDecreaseSuspicion: [],
    },
    {
      name: "Gastric malignancy",
      likelihood: "moderate",
      dangerous: true,
      why: "Persistent symptoms with weight loss warrant exclusion of malignancy.",
      supportingEvidence: ["Weight loss", "Persistent symptoms"],
      contradictingEvidence: [],
      wouldIncreaseSuspicion: ["Biopsy findings"],
      wouldDecreaseSuspicion: ["Normal endoscopy"],
    },
  ],
});

const CONTRADICTION_RESPONSE = JSON.stringify({
  hasContradiction: true,
  summary: "The working diagnosis may not fully explain the picture.",
  inconsistencies: ["Persistent symptoms despite treatment", "Unintentional weight loss"],
});

const MISSING_INFO_RESPONSE = JSON.stringify({ missingInformation: ["Any GI bleeding?", "Any family history of GI cancer?"] });

const INVESTIGATIONS_RESPONSE = JSON.stringify({
  investigations: [{ purpose: "To evaluate the current working diagnosis", items: ["Upper endoscopy"] }],
});

const FOLLOW_UP_RESPONSE = JSON.stringify({
  expected: "Symptom improvement within 2-4 weeks.",
  dueInDays: 14,
  ifImproving: "Continue monitoring.",
  ifNotImproving: "Escalate to upper endoscopy.",
});

function buildFullMockProvider() {
  return new MockProvider([
    { match: "Recurrent upper abdominal pain for four months", response: NORMALIZED_RESPONSE },
    { match: "Detected findings: Abdominal pain, Weight loss", response: RED_FLAGS_RESPONSE },
  ]);
}

test("orchestrator: runs the full pipeline in order and assembles a complete result", async () => {
  // One MockProvider instance can't disambiguate every stage by prompt
  // substring alone once several stages share phrasing, so this test uses
  // per-stage provider overrides — which also doubles as a real exercise
  // of the multi-model orchestration path (strategy doc §13), not just the
  // single-default-provider path.
  const providers = {
    default: new MockProvider([{ match: GI_CASE.presentingComplaint, response: NORMALIZED_RESPONSE }]),
    overrides: {
      red_flag_detection: new MockProvider([{ match: "Detected findings", response: RED_FLAGS_RESPONSE }]),
      differential_generation: new MockProvider([{ match: "Red flags already identified", response: DIFFERENTIAL_RESPONSE }]),
      contradiction_detection: new MockProvider([{ match: "Working diagnosis:", response: CONTRADICTION_RESPONSE }]),
      missing_information_analysis: new MockProvider([{ match: "Current differential:", response: MISSING_INFO_RESPONSE }]),
      investigation_considerations: new MockProvider([{ match: GI_CASE.presentingComplaint, response: INVESTIGATIONS_RESPONSE }]),
      follow_up_reasoning: new MockProvider([{ match: "Dangerous differential items", response: FOLLOW_UP_RESPONSE }]),
    },
  };
  const logger = new InMemoryLogger();
  const orchestrator = new ReasoningOrchestrator(providers, logger);

  const { result, safetyWarnings } = await orchestrator.runFullAnalysis(GI_CASE);

  assert.equal(result.normalized.detectedFindings.length, 2);
  assert.equal(result.redFlags.length, 1);
  assert.equal(result.differential.length, 2);
  assert.equal(result.differential[1]?.dangerous, true);
  assert.equal(result.contradiction.hasContradiction, true);
  assert.equal(result.missingInformation.length, 2);
  assert.equal(result.investigations.length, 1);
  assert.equal(result.followUp.dueInDays, 14);
  assert.equal(result.safetyVerification, undefined, "safety verification should not run unless explicitly requested");
  assert.deepEqual(safetyWarnings, {}, "clean mock responses should produce zero guardrail warnings");

  // Every one of the 7 stages that ran should have logged exactly once.
  assert.equal(logger.entries.length, 7);
  const stages = logger.entries.map((e) => e.stage);
  assert.deepEqual(stages, [
    "extraction_normalization",
    "red_flag_detection",
    "differential_generation",
    "contradiction_detection",
    "missing_information_analysis",
    "investigation_considerations",
    "follow_up_reasoning",
  ]);
});

test("orchestrator: skips contradiction detection when there is no working diagnosis", async () => {
  const contextWithoutWorkingDx: ClinicalContext = { ...GI_CASE, workingDiagnosis: undefined };
  const providers = {
    default: new MockProvider([{ match: GI_CASE.presentingComplaint, response: NORMALIZED_RESPONSE }]),
    overrides: {
      red_flag_detection: new MockProvider([{ match: "Detected findings", response: RED_FLAGS_RESPONSE }]),
      differential_generation: new MockProvider([{ match: "Red flags already identified", response: DIFFERENTIAL_RESPONSE }]),
      missing_information_analysis: new MockProvider([{ match: "Current differential:", response: MISSING_INFO_RESPONSE }]),
      investigation_considerations: new MockProvider([{ match: GI_CASE.presentingComplaint, response: INVESTIGATIONS_RESPONSE }]),
      follow_up_reasoning: new MockProvider([{ match: "Dangerous differential items", response: FOLLOW_UP_RESPONSE }]),
    },
  };
  const logger = new InMemoryLogger();
  const orchestrator = new ReasoningOrchestrator(providers, logger);

  const { result } = await orchestrator.runFullAnalysis(contextWithoutWorkingDx);

  assert.equal(result.contradiction.hasContradiction, false);
  assert.ok(!logger.entries.some((e) => e.stage === "contradiction_detection"), "contradiction stage should not have run at all, not just returned empty");
});

test("orchestrator: retries once on malformed JSON, then succeeds", async () => {
  let callCount = 0;
  const flakyThenGood = {
    name: "flaky-mock",
    async complete() {
      callCount++;
      if (callCount === 1) return { text: "not valid json at all", model: "flaky-model" };
      return { text: NORMALIZED_RESPONSE, model: "flaky-model" };
    },
  };
  const providers = {
    default: flakyThenGood,
    overrides: {
      red_flag_detection: new MockProvider([{ match: "Detected findings", response: RED_FLAGS_RESPONSE }]),
      differential_generation: new MockProvider([{ match: "Red flags already identified", response: DIFFERENTIAL_RESPONSE }]),
      missing_information_analysis: new MockProvider([{ match: "Current differential:", response: MISSING_INFO_RESPONSE }]),
      investigation_considerations: new MockProvider([{ match: GI_CASE.presentingComplaint, response: INVESTIGATIONS_RESPONSE }]),
      follow_up_reasoning: new MockProvider([{ match: "Dangerous differential items", response: FOLLOW_UP_RESPONSE }]),
    },
  };
  const logger = new InMemoryLogger();
  const orchestrator = new ReasoningOrchestrator(providers, logger);

  const { result } = await orchestrator.runFullAnalysis({ ...GI_CASE, workingDiagnosis: undefined });

  assert.equal(callCount, 2, "extraction_normalization's flaky provider should be called exactly twice: one failure, one retry that succeeds");
  assert.equal(result.normalized.detectedFindings.length, 2, "the pipeline should complete successfully using the retry's valid response");
  // Only one log entry for the stage, not one per attempt — attempts are
  // an internal retry detail, not separate stage runs.
  assert.equal(logger.entries.filter((e) => e.stage === "extraction_normalization").length, 1);
});

test("orchestrator: gives up after exhausting retries and logs the failure", async () => {
  const alwaysBroken = {
    name: "always-broken-mock",
    async complete() {
      return { text: "still not json", model: "broken-model" };
    },
  };
  const logger = new InMemoryLogger();
  const orchestrator = new ReasoningOrchestrator({ default: alwaysBroken }, logger);

  await assert.rejects(() => orchestrator.runFullAnalysis({ ...GI_CASE, workingDiagnosis: undefined }));

  const failureLog = logger.entries.find((e) => e.stage === "extraction_normalization");
  assert.ok(failureLog, "a failed stage should still produce an audit-log entry, not fail silently");
  assert.ok((failureLog!.output as { error?: string }).error, "the logged entry should record the failure reason");
});

test("orchestrator: refuses to return a dangerous differential item with no explanation", async () => {
  const badDifferential = JSON.stringify({
    differential: [
      { name: "Gastric malignancy", likelihood: "low", dangerous: true, supportingEvidence: [], contradictingEvidence: [], wouldIncreaseSuspicion: [], wouldDecreaseSuspicion: [] },
    ],
  });
  const providers = {
    default: new MockProvider([{ match: GI_CASE.presentingComplaint, response: NORMALIZED_RESPONSE }]),
    overrides: {
      red_flag_detection: new MockProvider([{ match: "Detected findings", response: RED_FLAGS_RESPONSE }]),
      differential_generation: new MockProvider([{ match: "Red flags already identified", response: badDifferential }]),
    },
  };
  const logger = new InMemoryLogger();
  const orchestrator = new ReasoningOrchestrator(providers, logger);

  await assert.rejects(() => orchestrator.runFullAnalysis({ ...GI_CASE, workingDiagnosis: undefined }), /without an explanation/i);
});

test("orchestrator: surfaces guardrail violations without blocking the pipeline", async () => {
  const overcertainNormalized = JSON.stringify({
    detectedFindings: ["Abdominal pain"],
    chronicity: "chronic",
    durationSummary: "you definitely have gastritis",
  });
  const providers = {
    default: new MockProvider([{ match: GI_CASE.presentingComplaint, response: overcertainNormalized }]),
    overrides: {
      red_flag_detection: new MockProvider([{ match: "Detected findings", response: RED_FLAGS_RESPONSE }]),
      differential_generation: new MockProvider([{ match: "Red flags already identified", response: DIFFERENTIAL_RESPONSE }]),
      missing_information_analysis: new MockProvider([{ match: "Current differential:", response: MISSING_INFO_RESPONSE }]),
      investigation_considerations: new MockProvider([{ match: GI_CASE.presentingComplaint, response: INVESTIGATIONS_RESPONSE }]),
      follow_up_reasoning: new MockProvider([{ match: "Dangerous differential items", response: FOLLOW_UP_RESPONSE }]),
    },
  };
  const logger = new InMemoryLogger();
  const orchestrator = new ReasoningOrchestrator(providers, logger);

  const { result, safetyWarnings } = await orchestrator.runFullAnalysis({ ...GI_CASE, workingDiagnosis: undefined });

  // The pipeline still completes — a guardrail hit is a flag, not a crash —
  // but it must be visible in the returned warnings, not silently dropped.
  assert.ok(result.normalized.detectedFindings.length > 0);
  assert.ok(safetyWarnings.extraction_normalization && safetyWarnings.extraction_normalization.length > 0);
});
