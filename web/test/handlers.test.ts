import { test } from "node:test";
import assert from "node:assert/strict";
import { MockProvider, ReasoningOrchestrator, NullLogger } from "@diagnowise/core";
import { createFakeSupabase } from "./fake-supabase";
import {
  handleAnalyzeCase,
  handleContradictionsRequest,
  handleDifferentialRequest,
  handleExplainRequest,
  handleFollowUpRequest,
  handleMissingInformationRequest,
  handleRedFlagsRequest,
} from "../lib/clinical/handlers";

const CLINICIAN = { id: "user-rao", email: "rao@northbridge.org" };
const OTHER_CLINICIAN = { id: "user-chen", email: "chen@riverside.org" };
const CASE_ID = "11111111-1111-1111-1111-111111111111";

const NORMALIZED = JSON.stringify({ detectedFindings: ["Abdominal pain"], chronicity: "chronic", durationSummary: "~4 months" });
const RED_FLAGS = JSON.stringify({
  redFlags: [{ label: "Weight loss", severity: "danger", why: "Raises concern for a structural cause.", relevantDiagnoses: [] }],
});
const DIFFERENTIAL = JSON.stringify({
  differential: [
    { name: "Gastritis", likelihood: "moderate", dangerous: false, supportingEvidence: [], contradictingEvidence: [], wouldIncreaseSuspicion: [], wouldDecreaseSuspicion: [] },
  ],
});
const CONTRADICTION = JSON.stringify({ hasContradiction: false, inconsistencies: [] });
const MISSING_INFO = JSON.stringify({ missingInformation: ["Any GI bleeding?"] });
const INVESTIGATIONS = JSON.stringify({ investigations: [{ purpose: "To evaluate the current working diagnosis", items: ["Upper endoscopy"] }] });
const FOLLOW_UP = JSON.stringify({ expected: "Improvement in 2 weeks.", dueInDays: 14, ifImproving: "Monitor.", ifNotImproving: "Escalate." });

function realMockOrchestrator() {
  return new ReasoningOrchestrator(
    {
      default: new MockProvider([{ match: "presenting complaint", response: NORMALIZED }]),
      overrides: {
        red_flag_detection: new MockProvider([{ match: "Detected findings", response: RED_FLAGS }]),
        differential_generation: new MockProvider([{ match: "Red flags already identified", response: DIFFERENTIAL }]),
        contradiction_detection: new MockProvider([{ match: "Working diagnosis:", response: CONTRADICTION }]),
        missing_information_analysis: new MockProvider([{ match: "Current differential:", response: MISSING_INFO }]),
        investigation_considerations: new MockProvider([{ match: "presenting complaint", response: INVESTIGATIONS }]),
        follow_up_reasoning: new MockProvider([{ match: "Dangerous differential items", response: FOLLOW_UP }]),
      },
    },
    new NullLogger()
  );
}

const VALID_CONTEXT_BODY = {
  patient: { age: 48, sex: "male" },
  presentingComplaint: "Recurrent presenting complaint of abdominal pain.",
  history: [{ label: "Duration", value: "4 months", source: "clinician" }],
};

test("handleDifferentialRequest: requires authentication", async () => {
  const supabase = createFakeSupabase({ authUser: null });
  await assert.rejects(
    () => handleDifferentialRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, VALID_CONTEXT_BODY),
    /Authentication required/
  );
});

test("handleDifferentialRequest: rejects an invalid body with a ValidationError, not a raw ZodError", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  await assert.rejects(
    () => handleDifferentialRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, { patient: { age: -5 } }),
    (err: any) => {
      assert.equal(err.name, "AppError");
      assert.equal(err.status, 422);
      return true;
    }
  );
});

test("handleDifferentialRequest: returns a differential for a valid authenticated request", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  const result = await handleDifferentialRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, VALID_CONTEXT_BODY);
  assert.equal(result.differential.length, 1);
  assert.equal(result.differential[0]?.name, "Gastritis");
  assert.deepEqual(result.safetyWarnings, {});
});

test("handleRedFlagsRequest: returns red flags without needing a differential", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  const result = await handleRedFlagsRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, VALID_CONTEXT_BODY);
  assert.equal(result.redFlags.length, 1);
  assert.equal(result.redFlags[0]?.label, "Weight loss");
});

test("handleMissingInformationRequest: chains through normalization, red flags, and differential", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  const result = await handleMissingInformationRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, VALID_CONTEXT_BODY);
  assert.deepEqual(result.missingInformation, ["Any GI bleeding?"]);
});

test("handleFollowUpRequest: returns a follow-up plan", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  const result = await handleFollowUpRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, VALID_CONTEXT_BODY);
  assert.equal(result.followUp.dueInDays, 14);
});

test("handleContradictionsRequest: rejects a request with no working diagnosis before calling the model at all", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  await assert.rejects(
    () => handleContradictionsRequest({ supabase, statelessOrchestratorFactory: realMockOrchestrator }, VALID_CONTEXT_BODY),
    (err: any) => {
      assert.equal(err.status, 422);
      return true;
    }
  );
});

test("handleContradictionsRequest: succeeds when a working diagnosis is provided", async () => {
  const supabase = createFakeSupabase({ authUser: CLINICIAN, tables: { users: [{ id: CLINICIAN.id, role: "clinician" }] } });
  const result = await handleContradictionsRequest(
    { supabase, statelessOrchestratorFactory: realMockOrchestrator },
    { ...VALID_CONTEXT_BODY, workingDiagnosis: "Peptic ulcer disease" }
  );
  assert.equal(result.contradiction.hasContradiction, false);
});

test("handleExplainRequest: returns the most recent stored interaction for a case+stage", async () => {
  const supabase = createFakeSupabase({
    authUser: CLINICIAN,
    tables: {
      users: [{ id: CLINICIAN.id, role: "clinician" }],
      cases: [{ id: CASE_ID, clinician_id: CLINICIAN.id, organization_id: "org-1" }],
      ai_interactions: [
        { case_id: CASE_ID, stage: "red_flag_detection", model: "claude-sonnet-4-6", input: {}, output: { note: "old" }, created_at: "2026-01-01" },
        { case_id: CASE_ID, stage: "red_flag_detection", model: "claude-sonnet-4-6", input: {}, output: { note: "new" }, created_at: "2026-02-01" },
      ],
    },
  });
  const result = await handleExplainRequest({ supabase }, { caseId: CASE_ID, stage: "red_flag_detection" });
  assert.equal((result.output as any).note, "new", "should return the most recent interaction, not just the first one");
});

test("handleExplainRequest: 404s when no interaction has been recorded for that stage", async () => {
  const supabase = createFakeSupabase({
    authUser: CLINICIAN,
    tables: { users: [{ id: CLINICIAN.id, role: "clinician" }], cases: [{ id: CASE_ID, clinician_id: CLINICIAN.id, organization_id: "org-1" }], ai_interactions: [] },
  });
  await assert.rejects(() => handleExplainRequest({ supabase }, { caseId: CASE_ID, stage: "follow_up_reasoning" }), (err: any) => {
    assert.equal(err.status, 404);
    return true;
  });
});

test("handleExplainRequest: an unrelated clinician gets 403, not the other clinician's reasoning", async () => {
  const supabase = createFakeSupabase({
    authUser: OTHER_CLINICIAN,
    tables: {
      users: [{ id: OTHER_CLINICIAN.id, role: "clinician" }],
      cases: [{ id: CASE_ID, clinician_id: CLINICIAN.id, organization_id: "org-1" }],
      ai_interactions: [{ case_id: CASE_ID, stage: "red_flag_detection", model: "m", input: {}, output: {}, created_at: "2026-01-01" }],
    },
  });
  await assert.rejects(() => handleExplainRequest({ supabase }, { caseId: CASE_ID, stage: "red_flag_detection" }), (err: any) => {
    assert.equal(err.status, 403);
    return true;
  });
});

test("handleAnalyzeCase: builds context from the case, persists results, and records an audit event", async () => {
  const supabase = createFakeSupabase({
    authUser: CLINICIAN,
    tables: {
      users: [{ id: CLINICIAN.id, role: "clinician", organization_id: "org-1" }],
      cases: [
        {
          id: CASE_ID,
          clinician_id: CLINICIAN.id,
          organization_id: "org-1",
          presenting_complaint: "Recurrent presenting complaint of abdominal pain.",
          working_diagnosis: null,
          patients: { age: 48, sex: "male" },
        },
      ],
      symptoms: [],
    },
  });

  const result = await handleAnalyzeCase(
    { supabase, statefulOrchestratorFactory: realMockOrchestrator },
    { caseId: CASE_ID }
  );

  assert.equal(result.analysis.differential.length, 1);
  assert.ok(result.persisted.diagnosisIds.length >= 1, "should have persisted at least one diagnosis row");
  const { data: logged } = await supabase.from("audit_logs").eq("entity_id", CASE_ID);
  assert.ok(logged.length >= 1, "should have recorded an audit event for the analysis");
  assert.equal(logged[0].action, "case.analyzed");
});

test("handleAnalyzeCase: a clinician not assigned to the case gets 403 before any analysis runs", async () => {
  const supabase = createFakeSupabase({
    authUser: OTHER_CLINICIAN,
    tables: {
      users: [{ id: OTHER_CLINICIAN.id, role: "clinician", organization_id: "org-2" }],
      cases: [{ id: CASE_ID, clinician_id: CLINICIAN.id, organization_id: "org-1", presenting_complaint: "x", patients: { age: 1, sex: "male" } }],
    },
  });
  await assert.rejects(() => handleAnalyzeCase({ supabase, statefulOrchestratorFactory: realMockOrchestrator }, { caseId: CASE_ID }), (err: any) => {
    assert.equal(err.status, 403);
    return true;
  });
});
