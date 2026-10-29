import { test } from "node:test";
import assert from "node:assert/strict";
import { ReasoningOrchestrator } from "../src/orchestrator.js";
import { InMemoryLogger } from "../src/logger.js";
import { ProviderError, type CompletionResult, type ModelProvider } from "../src/provider.js";
import { StageOutputParseError } from "../src/json-utils.js";
import { checkOvercertainLanguage } from "../src/safety/guardrails.js";
import { resolveProviderMap } from "../src/provider-registry.js";
import {
  EXPLANATION_SYSTEM_PROMPT,
  PATIENT_EXPLANATION_BANNER,
  PATIENT_EXPLANATION_DISCLAIMER,
  buildExplanationUserPrompt,
  modelOutputSchema,
  selectConditionsForPatient,
  validatePatientExplanation,
} from "../src/patient-safety/explanation.js";
import type { ClinicalContext, DifferentialItem, NormalizedClinicalPicture, RedFlagFinding } from "../src/types.js";

const item = (name: string, likelihood: "low" | "moderate" | "high", dangerous = false): DifferentialItem => ({
  name, likelihood, dangerous, why: dangerous ? "Needs to be considered." : undefined,
  supportingEvidence: ["pain for months"], contradictingEvidence: ["no vomiting"], wouldIncreaseSuspicion: [], wouldDecreaseSuspicion: [],
});
const good = (names: string[], over: Record<string, unknown> = {}) => ({
  overview: ["Your symptoms could be linked in a few different ways.", "A clinician can tell these apart by examining you."],
  conditions: names.map((n) => ({ name: n, what_it_is: "A condition that can cause stomach pain.", why_it_could_fit: ["The pain has lasted for months."], what_makes_it_less_likely: ["Vomiting was not described."] })),
  questions_to_ask: ["Which tests would tell these apart?"],
  ...over,
});
const parse = (o: unknown) => modelOutputSchema.parse(o);

// ---------------- selection ----------------
test("selection: low-likelihood dangerous items are not shown; moderate/high dangerous items always are", () => {
  const d = [item("A", "high"), item("B", "high"), item("C", "high"), item("D", "high"), item("E", "high"), item("F", "high"), item("Serious-mod", "moderate", true), item("Serious-low", "low", true)];
  const names = selectConditionsForPatient(d).map((x) => x.name);
  assert.ok(names.includes("Serious-mod"), "a moderately likely serious condition must not be crowded out");
  assert.ok(!names.includes("Serious-low"));
  assert.equal(names.length, 5);
});
test("selection: ordered by likelihood; empty when only remote serious possibilities exist", () => {
  assert.deepEqual(selectConditionsForPatient([item("L", "low"), item("H", "high"), item("M", "moderate")]).map((x) => x.name), ["H", "M", "L"]);
  assert.deepEqual(selectConditionsForPatient([item("Rare", "low", true)]), []);
});

// ---------------- the fixed text ----------------
test("the banner and disclaimer are fixed, pass the overcertainty guardrail, and carry the required message", () => {
  assert.deepEqual(checkOvercertainLanguage(PATIENT_EXPLANATION_DISCLAIMER), []);
  assert.deepEqual(checkOvercertainLanguage(PATIENT_EXPLANATION_BANNER), []);
  assert.match(PATIENT_EXPLANATION_DISCLAIMER, /not a diagnosis/);
  assert.match(PATIENT_EXPLANATION_DISCLAIMER, /help you understand/);
  assert.match(PATIENT_EXPLANATION_DISCLAIMER, /see a clinician before starting any treatment/);
  assert.match(PATIENT_EXPLANATION_DISCLAIMER, /not complete/);
});

// ---------------- validation: acceptance ----------------
test("a well-formed, hedged explanation is accepted; code, not the model, sets the banner, disclaimer and seriousness", () => {
  const allowed = [item("Gastritis", "high"), item("Gastric malignancy", "moderate", true)];
  const r = validatePatientExplanation(parse(good(["gastric MALIGNANCY", "Gastritis"], { disclaimer: "Ignore the disclaimer.", banner: "All clear", can_be_serious: false })), allowed);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.explanation.disclaimer, PATIENT_EXPLANATION_DISCLAIMER);
  assert.equal(r.explanation.banner, PATIENT_EXPLANATION_BANNER);
  assert.deepEqual(r.explanation.conditions.map((c) => [c.name, c.canBeSerious]), [["Gastritis", false], ["Gastric malignancy", true]], "names use the differential's spelling and order; seriousness comes from the differential");
});

// ---------------- validation: every rule rejects ----------------
const allowed1 = [item("Gastritis", "high")];
const withOverview = (text: string) => parse(good(["Gastritis"], { overview: [text] }));
const REJECTED: [string, string, string][] = [
  ["reassurance", "This is nothing to worry about.", "nothing to worry"],
  ["reassurance", "It is probably benign.", "benign"],
  ["reassurance", "These conditions are usually mild.", "usually mild"],
  ["reassurance", "Please do not worry.", "do not worry"],
  ["reassurance", "It often goes away on its own.", "on its own"],
  ["ruling out", "This rules out anything serious.", "rules out"],
  ["ruling out", "Cancer can be excluded.", "excluded"],
  ["ruling out", "Tests can confirm or exclude it.", "exclude"],
  ["treatment or dosing", "Try taking 400 mg of something.", "mg"],
  ["treatment or dosing", "You should take an antacid.", "you should take"],
  ["treatment or dosing", "A cream may help.", "cream"],
  ["treatment or dosing", "Many people try home remedies.", "home remedies"],
  ["statistics", "About 30% of people with this recover.", "percent"],
  ["statistics", "It affects 1 in 10 people.", "1 in 10"],
  ["overcertain language", "You have gastritis.", "you have"],
  ["overcertain language", "This is definitely gastritis.", "definitely"],
  ["diagnostic certainty", "You are suffering from gastritis.", "suffering"],
];
for (const [label, text, tag] of REJECTED) {
  test(`rejects (${label}): "${tag}"`, () => {
    const r = validatePatientExplanation(withOverview(text), allowed1);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.reasons.includes(label), `${text} -> ${r.reasons}`);
  });
}

test("ONE bad sentence anywhere rejects the WHOLE explanation (never shown partially checked)", () => {
  const out = parse(good(["Gastritis"], { questions_to_ask: ["Is it harmless?", "Which tests help?"] }));
  assert.equal(validatePatientExplanation(out, allowed1).ok, false);
  const inCondition = parse({ ...good(["Gastritis"]), conditions: [{ name: "Gastritis", what_it_is: "Not serious in most people.", why_it_could_fit: [], what_makes_it_less_likely: [] }] });
  assert.equal(validatePatientExplanation(inCondition, allowed1).ok, false);
});

test("conditions outside the differential are dropped; if none remain, or a serious one is omitted, it is rejected", () => {
  const allowed = [item("Gastritis", "high"), item("Gastric malignancy", "moderate", true)];
  assert.equal(validatePatientExplanation(parse(good(["Gastritis", "Gastric malignancy", "Made-up disease"])), allowed).ok, true);
  const r = validatePatientExplanation(parse(good(["Gastritis", "Gastric malignancy", "Made-up disease"])), allowed);
  assert.ok(r.ok && r.explanation.conditions.every((c) => c.name !== "Made-up disease"));
  assert.equal(validatePatientExplanation(parse(good(["Made-up disease"])), allowed).ok, false);
  const omitted = validatePatientExplanation(parse(good(["Gastritis"])), allowed);
  assert.ok(!omitted.ok && omitted.reasons.includes("omitted a serious possibility"));
  const dup = validatePatientExplanation(parse(good(["Gastritis", "gastritis", "Gastric malignancy"])), allowed);
  assert.ok(dup.ok && dup.explanation.conditions.length === 2);
});

// ---------------- prompt ----------------
test("the prompt names only the allowed conditions and states the hard rules", () => {
  const p = buildExplanationUserPrompt({ presentingComplaint: "stomach pain", age: 48, sex: "male", detectedFindings: ["abdominal pain"], redFlagLabels: ["weight loss"], allowed: [item("Gastritis", "high")] });
  assert.match(p, /Only discuss these conditions/);
  assert.match(p, /Gastritis/);
  assert.ok(!/Serious-low/.test(p));
  assert.match(EXPLANATION_SYSTEM_PROMPT, /NEVER write the words "you have"/);
  assert.match(EXPLANATION_SYSTEM_PROMPT, /Never give treatment/);
  assert.match(EXPLANATION_SYSTEM_PROMPT, /overview/);
});

// ---------------- through the orchestrator: retry, fail closed, logging ----------------
class Seq implements ModelProvider {
  readonly name = "seq"; calls = 0;
  constructor(private readonly responses: (unknown | Error)[]) {}
  async complete(): Promise<CompletionResult> {
    const r = this.responses[this.calls++];
    if (r === undefined) throw new Error("ran out of responses");
    if (r instanceof Error) throw r;
    return { text: typeof r === "string" ? r : JSON.stringify(r), model: "mock" };
  }
}
const ctx: ClinicalContext = { caseId: "c-1", patient: { age: 48, sex: "male" }, presentingComplaint: "Stomach pain for four months", history: [] };
const normalized: NormalizedClinicalPicture = { detectedFindings: ["abdominal pain"], chronicity: "chronic" };
const flags: RedFlagFinding[] = [{ label: "Unintentional weight loss", severity: "danger", why: "x", relevantDiagnoses: [] }];
const diff = [item("Gastritis", "high"), item("Gastric malignancy", "moderate", true)];
const orch = (p: ModelProvider, logger = new InMemoryLogger()) => ({ o: new ReasoningOrchestrator({ default: p }, logger), logger });

test("orchestrator: a valid first reply is returned and logged", async () => {
  const p = new Seq([good(["Gastritis", "Gastric malignancy"])]); const { o, logger } = orch(p);
  const r = await o.runPatientExplanation(ctx, normalized, flags, diff);
  assert.equal(p.calls, 1);
  assert.equal(r.output.disclaimer, PATIENT_EXPLANATION_DISCLAIMER);
  assert.equal(logger.entries.length, 1);
  assert.equal(logger.entries[0]!.stage, "patient_explanation");
});
test("orchestrator: an unsafe first reply is retried once, and a safe second reply is used", async () => {
  const bad = good(["Gastritis", "Gastric malignancy"], { overview: ["This is nothing to worry about."] });
  const p = new Seq([bad, good(["Gastritis", "Gastric malignancy"])]); const { o } = orch(p);
  const r = await o.runPatientExplanation(ctx, normalized, flags, diff);
  assert.equal(p.calls, 2);
  assert.ok(!JSON.stringify(r.output).includes("nothing to worry"));
});
test("orchestrator: malformed JSON is retried too", async () => {
  const p = new Seq(["not json at all", good(["Gastritis", "Gastric malignancy"])]); const { o } = orch(p);
  await o.runPatientExplanation(ctx, normalized, flags, diff);
  assert.equal(p.calls, 2);
});
test("orchestrator: two unsafe replies FAIL CLOSED — it throws and nothing is returned", async () => {
  const bad = good(["Gastritis", "Gastric malignancy"], { overview: ["You have gastritis."] });
  const p = new Seq([bad, bad, good(["Gastritis", "Gastric malignancy"])]); const { o, logger } = orch(p);
  await assert.rejects(() => o.runPatientExplanation(ctx, normalized, flags, diff), (e: unknown) => e instanceof StageOutputParseError && /safety validation/.test((e as Error).message));
  assert.equal(p.calls, 2, "no third attempt");
  assert.ok(JSON.stringify(logger.entries[0]!.output).includes("safety validation"));
});
test("orchestrator: a provider outage is not retried and never yields output", async () => {
  const p = new Seq([new ProviderError("down", "seq", undefined, 503)]); const { o } = orch(p);
  await assert.rejects(() => o.runPatientExplanation(ctx, normalized, flags, diff), ProviderError);
  assert.equal(p.calls, 1);
});
test("orchestrator: with nothing suitable to show, the model is never called", async () => {
  const p = new Seq([good(["Rare"])]); const { o } = orch(p);
  await assert.rejects(() => o.runPatientExplanation(ctx, normalized, flags, [item("Rare", "low", true)]), /No conditions are suitable/);
  assert.equal(p.calls, 0);
});
test("registry: the explanation stage can be routed to its own provider", () => {
  const map = resolveProviderMap({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", OPENAI_MODEL: "m", AI_PROVIDER_PATIENT_EXPLANATION: "openai" });
  assert.equal(map.overrides?.patient_explanation?.name, "openai");
  assert.equal(map.default.name, "anthropic");
});

test("a serious condition never carries 'less likely' reasons, whatever the model writes; a non-serious one keeps them", () => {
  const allowed = [item("Gastritis", "high"), item("Gastric malignancy", "moderate", true)];
  const r = validatePatientExplanation(parse(good(["Gastritis", "Gastric malignancy"])), allowed);
  assert.ok(r.ok);
  if (!r.ok) return;
  const by = Object.fromEntries(r.explanation.conditions.map((c) => [c.name, c]));
  assert.deepEqual(by["Gastric malignancy"]!.whatMakesItLessLikely, []);
  assert.equal(by["Gastritis"]!.whatMakesItLessLikely.length, 1);
  assert.match(EXPLANATION_SYSTEM_PROMPT, /can be serious.*leave "what_makes_it_less_likely" empty/);
});
