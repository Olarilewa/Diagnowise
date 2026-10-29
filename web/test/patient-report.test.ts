import { test } from "node:test";
import assert from "node:assert/strict";
import { NullLogger, PATIENT_EXPLANATION_DISCLAIMER, ProviderError, ReasoningOrchestrator, type CompletionResult, type ModelProvider } from "@diagnowise/core";
import { createFakeSupabase } from "./fake-supabase";
import { handlePatientReport } from "../lib/patient/submit-report";
import {
  handleContradictionsRequest,
  handleDifferentialRequest,
  handleFollowUpRequest,
  handleMissingInformationRequest,
  handleRedFlagsRequest,
} from "../lib/clinical/handlers";

const PATIENT = { id: "pat-1", email: "p@x.org" };
const CLINICIAN = { id: "cl-1", email: "c@x.org" };
const USERS = [
  { id: PATIENT.id, role: "patient", name: "Pat One", email: PATIENT.email },
  { id: CLINICIAN.id, role: "clinician", name: "Dr C", email: CLINICIAN.email },
];

/** Returns canned responses in call order; the pipeline order (extract, red flags, differential, missing info) is fixed. */
class SequenceProvider implements ModelProvider {
  readonly name = "sequence";
  calls = 0;
  constructor(private readonly responses: unknown[]) {}
  async complete(): Promise<CompletionResult> {
    const next = this.responses[this.calls++];
    if (next === undefined) throw new Error("SequenceProvider ran out of responses");
    return { text: JSON.stringify(next), model: "mock" };
  }
}
class DownProvider implements ModelProvider {
  readonly name = "down";
  calls = 0;
  async complete(): Promise<CompletionResult> {
    this.calls++;
    throw new ProviderError("provider is down", "down", undefined, 503);
  }
}
const orchestratorOver = (p: ModelProvider) => () => new ReasoningOrchestrator({ default: p }, new NullLogger());

const NORMALIZED = { detectedFindings: ["Abdominal pain", "Weight loss"], chronicity: "chronic", durationSummary: "about 4 months" };
const RED_FLAGS = { redFlags: [{ label: "Unintentional weight loss", severity: "danger", why: "Raises concern for gastric malignancy.", relevantDiagnoses: ["Gastric malignancy"] }] };
const DIFFERENTIAL = {
  differential: [
    { name: "Gastric malignancy", likelihood: "moderate", dangerous: true, why: "Weight loss with persistent symptoms.", supportingEvidence: [], contradictingEvidence: [], wouldIncreaseSuspicion: [], wouldDecreaseSuspicion: [] },
    { name: "Gastritis", likelihood: "high", dangerous: false, supportingEvidence: [], contradictingEvidence: [], wouldIncreaseSuspicion: [], wouldDecreaseSuspicion: [] },
  ],
};
const MISSING = { missingInformation: ["Any family history of cancer?", "Has there been any black or bloody stool?"] };

const VALID = { summary: "Stomach pain and I have lost weight over about four months.", onset: "4 months ago", severity: "moderate", age: 48, sex: "male", acknowledgedAiProcessing: true };
const supabaseFor = (user = PATIENT) => createFakeSupabase({ authUser: user, tables: { users: [...USERS] } });
const mustNotCallAi = () => { throw new Error("AI must not be called on this path"); };

test("only patients can submit; a clinician is refused before anything runs", async () => {
  await assert.rejects(() => handlePatientReport({ supabase: supabaseFor(CLINICIAN), orchestratorFactory: mustNotCallAi }, VALID), (e: any) => e.status === 403);
  await assert.rejects(() => handlePatientReport({ supabase: createFakeSupabase({ authUser: null }), orchestratorFactory: mustNotCallAi }, VALID), (e: any) => e.status === 401);
});

test("the AI-processing acknowledgement is mandatory, and bad input is a 422 before any AI call", async () => {
  for (const bad of [{ ...VALID, acknowledgedAiProcessing: false }, { ...VALID, acknowledgedAiProcessing: undefined }, { ...VALID, summary: "   " }, { ...VALID, age: -1 }, { ...VALID, sex: "robot" }]) {
    await assert.rejects(() => handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: mustNotCallAi }, bad), (e: any) => e.status === 422);
  }
});

test("emergency text: guidance is immediate, the AI is NEVER called, and the report is still saved", async () => {
  const supabase = supabaseFor();
  const r = await handlePatientReport({ supabase, orchestratorFactory: mustNotCallAi }, { ...VALID, summary: "I have crushing chest pain and I can't breathe" });
  assert.equal(r.guidance.urgency, "emergency");
  assert.equal(r.assessedByAi, false);
  assert.ok(r.reportId);
  const { data } = await supabase.from("patient_reports").eq("patient_id", PATIENT.id);
  assert.equal(data.length, 1);
  assert.equal(data[0].details.urgency, "emergency");
});

test("crisis text: crisis response, AI never called", async () => {
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: mustNotCallAi }, { ...VALID, summary: "I want to die" });
  assert.equal(r.guidance.mode, "crisis");
  assert.equal(r.assessedByAi, false);
});

test("onset text is screened too, not just the summary", async () => {
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: mustNotCallAi }, { ...VALID, summary: "Feeling unwell", onset: "since I took an overdose" });
  assert.equal(r.guidance.urgency, "emergency");
});

const EXPLANATION = {
  overview: ["Your symptoms could be linked in a few different ways.", "A clinician can tell these apart by examining you and, if needed, arranging tests."],
  conditions: [
    { name: "Gastritis", what_it_is: "Irritation of the stomach lining that can cause pain.", why_it_could_fit: ["Stomach pain that has lasted for months."], what_makes_it_less_likely: ["Weight loss is not typical of simple irritation."] },
    { name: "Gastric malignancy", what_it_is: "A growth in the stomach that needs a clinician to check.", why_it_could_fit: ["Weight loss together with long-lasting pain."], what_makes_it_less_likely: [] },
  ],
  questions_to_ask: ["Which tests would tell these apart?"],
};
const UNSAFE = { ...EXPLANATION, overview: ["This is nothing to worry about."] };
const FIVE = [NORMALIZED, RED_FLAGS, DIFFERENTIAL, MISSING, EXPLANATION];

test("normal path: guidance stays diagnosis-free, and the explanation is the ONLY channel for named conditions", async () => {
  const provider = new SequenceProvider(FIVE);
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(provider), explanationEnabled: true }, VALID);
  assert.equal(provider.calls, 5);
  assert.equal(r.assessedByAi, true);
  assert.equal(r.guidance.urgency, "urgent");
  const g = JSON.stringify(r.guidance).toLowerCase();
  for (const banned of ["malignan", "gastritis", "gastric", "cancer", "raises concern"]) assert.ok(!g.includes(banned), `guidance leaked: ${banned}`);
  assert.deepEqual(r.guidance.featuresToMention, ["Unintentional weight loss"]);
  assert.deepEqual(r.guidance.questionsForYourClinician, ["Has there been any black or bloody stool?"]);
  assert.ok(r.explanation, "explanation expected");
  assert.deepEqual(r.explanation!.conditions.map((c) => [c.name, c.canBeSerious]), [["Gastritis", false], ["Gastric malignancy", true]]);
  assert.equal(r.explanation!.disclaimer, PATIENT_EXPLANATION_DISCLAIMER);
  assert.equal(r.explanation!.overview.length, 2, "the plain-language overview is present (and rendered before the conditions)");
});

test("explanation: unsafe model text twice means NO explanation, but the patient still gets guidance and the report is saved", async () => {
  const provider = new SequenceProvider([NORMALIZED, RED_FLAGS, DIFFERENTIAL, MISSING, UNSAFE, UNSAFE]);
  const supabase = supabaseFor();
  const r = await handlePatientReport({ supabase, orchestratorFactory: orchestratorOver(provider), explanationEnabled: true }, VALID);
  assert.equal(provider.calls, 6, "one retry, then give up");
  assert.equal(r.explanation, null);
  assert.equal(r.guidance.urgency, "urgent");
  assert.ok(r.reportId);
  assert.ok(!JSON.stringify(r).includes("nothing to worry"));
  const { data } = await supabase.from("patient_reports").eq("patient_id", PATIENT.id);
  assert.equal(data[0].details.explained, false);
});

test("explanation: an unsafe first reply is retried, and the safe second reply is shown", async () => {
  const provider = new SequenceProvider([NORMALIZED, RED_FLAGS, DIFFERENTIAL, MISSING, UNSAFE, EXPLANATION]);
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(provider), explanationEnabled: true }, VALID);
  assert.ok(r.explanation);
  assert.ok(!JSON.stringify(r).includes("nothing to worry"));
});

test("explanation: a condition the pipeline never produced is dropped, never shown", async () => {
  const withExtra = { ...EXPLANATION, conditions: [...EXPLANATION.conditions, { name: "Made-up disease", what_it_is: "Invented.", why_it_could_fit: [], what_makes_it_less_likely: [] }] };
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(new SequenceProvider([NORMALIZED, RED_FLAGS, DIFFERENTIAL, MISSING, withExtra])), explanationEnabled: true }, VALID);
  assert.ok(!JSON.stringify(r).includes("Made-up disease"));
  assert.equal(r.explanation?.conditions.length, 2);
});

test("kill switch: with possible diagnoses switched off there is no explanation and no extra model call", async () => {
  const provider = new SequenceProvider(FIVE);
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(provider), explanationEnabled: false }, VALID);
  assert.equal(provider.calls, 4);
  assert.equal(r.explanation, null);
  assert.equal(r.guidance.urgency, "urgent");
});

test("explanation: a provider failure at the explanation step leaves the guidance intact", async () => {
  const provider = new SequenceProvider([NORMALIZED, RED_FLAGS, DIFFERENTIAL, MISSING]); // the 5th call runs out and throws
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(provider), explanationEnabled: true }, VALID);
  assert.equal(r.explanation, null);
  assert.equal(r.assessedByAi, true);
  assert.equal(r.guidance.urgency, "urgent");
});

test("explanation: if only a remote serious possibility exists, nothing is shown and the model is not asked", async () => {
  const remote = { differential: [{ ...DIFFERENTIAL.differential[0]!, likelihood: "low" }] };
  const provider = new SequenceProvider([NORMALIZED, RED_FLAGS, remote, MISSING, EXPLANATION]);
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(provider), explanationEnabled: true }, VALID);
  assert.equal(provider.calls, 4);
  assert.equal(r.explanation, null);
});

test("the saved report records only the NAMES of conditions the patient was shown, so a clinician knows what they were told", async () => {
  const supabase = supabaseFor();
  await handlePatientReport({ supabase, orchestratorFactory: orchestratorOver(new SequenceProvider(FIVE)), explanationEnabled: true }, VALID);
  const { data } = await supabase.from("patient_reports").eq("patient_id", PATIENT.id);
  assert.equal(data[0].details.explained, true);
  assert.deepEqual(data[0].details.possible_conditions, ["Gastritis", "Gastric malignancy"]);
  assert.ok(!JSON.stringify(data[0].details).includes("Irritation of the stomach lining"), "explanation prose is not stored");
  const { data: audit } = await supabase.from("audit_logs").eq("action", "patient.report_submitted");
  assert.deepEqual(audit[0].metadata, { urgency: "urgent", mode: "standard", explained: true });
});

test("emergency and crisis text never produce an explanation or reach the AI", async () => {
  for (const summary of ["I can't breathe", "I want to die"]) {
    const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: mustNotCallAi, explanationEnabled: true }, { ...VALID, summary });
    assert.equal(r.explanation, null);
    assert.equal(r.assessedByAi, false);
  }
});


test("AI failure: the patient still gets fail-safe guidance, and the report is saved", async () => {
  const provider = new DownProvider();
  const r = await handlePatientReport({ supabase: supabaseFor(), orchestratorFactory: orchestratorOver(provider) }, VALID);
  assert.ok(provider.calls >= 1);
  assert.equal(r.assessedByAi, false);
  assert.equal(r.guidance.urgency, "soon");
  assert.match(r.guidance.headline, /couldn't fully assess/);
  assert.ok(r.reportId);
});

test("a database failure never withholds guidance", async () => {
  const base = createFakeSupabase({ authUser: PATIENT, tables: { users: [...USERS] } });
  const supabase = {
    ...base,
    from: (t: string) => (t === "patient_reports" ? { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "db down" } }) }) }) } : base.from(t)),
  } as any;
  const r = await handlePatientReport({ supabase, orchestratorFactory: mustNotCallAi }, { ...VALID, summary: "I can't breathe" });
  assert.equal(r.guidance.urgency, "emergency");
  assert.equal(r.reportId, null);
});

test("the audit event records the urgency tier but never the patient's words", async () => {
  const supabase = supabaseFor();
  await handlePatientReport({ supabase, orchestratorFactory: mustNotCallAi }, { ...VALID, summary: "I can't breathe at all, secret-marker-123" });
  const { data } = await supabase.from("audit_logs").eq("action", "patient.report_submitted");
  assert.equal(data.length, 1);
  assert.deepEqual(data[0].metadata, { urgency: "emergency", mode: "standard", explained: false });
  assert.ok(!JSON.stringify(data).includes("secret-marker-123"));
});

test("patients cannot reach the raw clinical endpoints (they return named diagnoses)", async () => {
  const body = { patient: { age: 48, sex: "male" }, presentingComplaint: "Stomach pain", history: [], workingDiagnosis: "Gastritis" };
  const deps = { supabase: supabaseFor(), statelessOrchestratorFactory: mustNotCallAi };
  for (const [name, handler] of [["differential", handleDifferentialRequest], ["red-flags", handleRedFlagsRequest], ["missing-information", handleMissingInformationRequest], ["follow-up", handleFollowUpRequest], ["contradictions", handleContradictionsRequest]] as const) {
    await assert.rejects(() => handler(deps, body), (e: any) => e.status === 403, name);
  }
});
