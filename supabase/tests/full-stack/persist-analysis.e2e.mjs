import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { persistCaseAnalysis } from "./persist-analysis.bundle.mjs";

const JWT_SECRET = "this-is-a-local-test-only-jwt-secret-not-used-anywhere-real-32chars";
const SUPABASE_URL = "http://127.0.0.1:3112";
const CASE_ID = "c0000000-0000-0000-0000-000000000001";
const RAO_USER_ID = "a0000000-0000-0000-0000-000000000002";

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

function signJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const unsigned = `${base64url(header)}.${base64url(payload)}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

const raoJwt = signJwt({
  sub: RAO_USER_ID,
  role: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const supabaseAsRao = createClient(SUPABASE_URL, "unused-anon-key-postgrest-doesnt-check-this-locally", {
  global: { headers: { Authorization: `Bearer ${raoJwt}` } },
  auth: { persistSession: false },
});

// A believable analysis result, matching CaseAnalysisResult's real shape —
// not simplified for the test, so this exercises every branch persist-analysis.ts has.
const analysisResult = {
  normalized: { detectedFindings: ["Abdominal pain", "Weight loss"], chronicity: "chronic", durationSummary: "~4 months" },
  redFlags: [
    { label: "Unintentional weight loss", severity: "danger", why: "Raises concern for a structural cause.", relevantDiagnoses: ["Gastric malignancy"] },
  ],
  differential: [
    {
      name: "Peptic ulcer disease", likelihood: "moderate", dangerous: false,
      supportingEvidence: ["Epigastric pain pattern"], contradictingEvidence: ["No improvement after PPI trial"],
      wouldIncreaseSuspicion: ["Endoscopic confirmation"], wouldDecreaseSuspicion: [],
    },
    {
      name: "Gastric malignancy", likelihood: "moderate", dangerous: true,
      why: "Persistent symptoms with weight loss warrant exclusion of malignancy.",
      supportingEvidence: ["Weight loss", "Persistent symptoms"], contradictingEvidence: [],
      wouldIncreaseSuspicion: ["Biopsy findings"], wouldDecreaseSuspicion: ["Normal endoscopy"],
    },
  ],
  contradiction: { hasContradiction: true, summary: "Working diagnosis may not fully explain the picture.", inconsistencies: ["Persistent symptoms despite treatment"] },
  missingInformation: ["Any GI bleeding?"],
  investigations: [{ purpose: "To evaluate the current working diagnosis", items: ["Upper endoscopy"] }],
  followUp: { expected: "Improvement within 2-4 weeks.", dueInDays: 14, ifImproving: "Continue monitoring.", ifNotImproving: "Escalate to endoscopy." },
};

console.log("Running persistCaseAnalysis against a REAL PostgREST + Postgres stack as Dr. Rao...");
const outcome = await persistCaseAnalysis(supabaseAsRao, CASE_ID, analysisResult);
console.log("Persist result:", outcome);

assert.equal(outcome.diagnosisIds.length, 2, "should have persisted 2 diagnoses");
assert.equal(outcome.redFlagIds.length, 1, "should have persisted 1 red flag");
assert.ok(outcome.contradictionId, "should have persisted a contradiction since hasContradiction=true");
assert.equal(outcome.investigationIds.length, 1, "should have persisted 1 investigation");
assert.ok(outcome.followUpId, "should have persisted a follow-up");

// Read it back through the SAME RLS-scoped session, proving these rows are
// genuinely visible to the clinician who created them (not just that the
// insert didn't error).
const { data: diagnoses, error: readDxError } = await supabaseAsRao.from("diagnoses").select("diagnosis, category").eq("case_id", CASE_ID);
assert.equal(readDxError, null);
assert.equal(diagnoses.length, 2);
assert.ok(diagnoses.some((d) => d.category === "dangerous" && d.diagnosis === "Gastric malignancy"));

const { data: timeline } = await supabaseAsRao.from("case_timeline_events").select("event").eq("case_id", CASE_ID);
assert.ok(timeline.some((t) => t.event === "Diagnostic reconsideration triggered"));
assert.ok(timeline.some((t) => t.event === "Diagnostic analysis completed"));

// --- Now prove RLS still blocks a DIFFERENT, unrelated clinician. ---
const chenJwt = signJwt({ sub: "a0000000-0000-0000-0000-000000000099", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
const supabaseAsChen = createClient(SUPABASE_URL, "unused", { global: { headers: { Authorization: `Bearer ${chenJwt}` } }, auth: { persistSession: false } });
const { data: chenView } = await supabaseAsChen.from("diagnoses").select("*").eq("case_id", CASE_ID);
assert.equal(chenView.length, 0, "an unrelated user (no profile row, not the assigned clinician) must see zero rows for this case");

console.log("\n✅ All real end-to-end assertions passed: persistCaseAnalysis works against a live PostgREST+Postgres stack, through real RLS, with the real @supabase/supabase-js client.");
