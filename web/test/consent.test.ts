import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase";
import { createShareCode, listMyConsents, listSharedReports, revokeConsent, shareWithClinician } from "../lib/patient/consent";

const PATIENT = { id: "pat-1", email: "p@x.org" };
const CLINICIAN = { id: "cl-1", email: "c@x.org" };
const ADMIN = { id: "ad-1", email: "a@x.org" };
const USERS = [
  { id: PATIENT.id, role: "patient", name: "Pat One", email: PATIENT.email },
  { id: CLINICIAN.id, role: "clinician", name: "Dr One", email: CLINICIAN.email },
  { id: ADMIN.id, role: "hospital_admin", name: "Admin", email: ADMIN.email },
];
type Rpc = (name: string, args?: unknown) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
function clientFor(user: { id: string; email: string } | null, rpc: Rpc = async () => ({ data: [], error: null })) {
  const base = createFakeSupabase({ authUser: user, tables: { users: [...USERS] } });
  const calls: { name: string; args: unknown }[] = [];
  return { supabase: { ...base, rpc: async (name: string, args?: unknown) => { calls.push({ name, args }); return rpc(name, args); } } as any, calls };
}
const never: Rpc = async () => { throw new Error("rpc must not be called"); };

test("sharing: only patients can enter a code; nothing reaches the database otherwise", async () => {
  for (const user of [CLINICIAN, ADMIN]) {
    const { supabase, calls } = clientFor(user, never);
    await assert.rejects(() => shareWithClinician(supabase, { code: "ABCDE-FGHIJ" }), (e: any) => e.status === 403);
    assert.equal(calls.length, 0);
  }
  await assert.rejects(() => shareWithClinician(clientFor(null, never).supabase, { code: "ABCDE-FGHIJ" }), (e: any) => e.status === 401);
});

test("sharing: malformed codes are a 422 and never hit the database", async () => {
  for (const bad of ["", "abc", "x".repeat(25), "ABCDE'; drop table users;--", "ABCDE_FGHIJ", undefined]) {
    const { supabase, calls } = clientFor(PATIENT, never);
    await assert.rejects(() => shareWithClinician(supabase, { code: bad }), (e: any) => e.status === 422, String(bad));
    assert.equal(calls.length, 0);
  }
});

test("sharing: statuses map correctly, and the code is passed through untouched for the database to normalise", async () => {
  const mk = (status: string, extra = {}) => async () => ({ data: [{ status, consent_id: null, clinician_name: null, ...extra }], error: null });
  const ok = clientFor(PATIENT, mk("ok", { consent_id: "c-1", clinician_name: "Dr One" }));
  assert.deepEqual(await shareWithClinician(ok.supabase, { code: " ab12c-de34f " }), { status: "ok", consentId: "c-1", clinicianName: "Dr One" });
  assert.deepEqual(ok.calls[0], { name: "grant_consent_by_code", args: { code: "ab12c-de34f" } });
  assert.equal((await shareWithClinician(clientFor(PATIENT, mk("already_shared", { consent_id: "c-1", clinician_name: "Dr One" })).supabase, { code: "ABCDE-FGHIJ" })).status, "already_shared");
  assert.deepEqual(await shareWithClinician(clientFor(PATIENT, mk("invalid")).supabase, { code: "ABCDE-FGHIJ" }), { status: "invalid" });
  assert.deepEqual(await shareWithClinician(clientFor(PATIENT, mk("rate_limited")).supabase, { code: "ABCDE-FGHIJ" }), { status: "rate_limited" });
  // an 'ok' row with missing details must not be trusted as success
  assert.deepEqual(await shareWithClinician(clientFor(PATIENT, mk("ok")).supabase, { code: "ABCDE-FGHIJ" }), { status: "invalid" });
});

test("sharing: a database error becomes a generic error that leaks nothing", async () => {
  const { supabase } = clientFor(PATIENT, async () => ({ data: null, error: { code: "XX000", message: "relation clinician_share_codes secret detail" } }));
  await assert.rejects(() => shareWithClinician(supabase, { code: "ABCDE-FGHIJ" }), (e: any) => e.message === "Could not process the sharing code." && !/secret|relation/.test(e.message));
});

test("revoking: patients only, valid ids only, not-found maps to 404", async () => {
  await assert.rejects(() => revokeConsent(clientFor(CLINICIAN, never).supabase, { consentId: "11111111-1111-1111-1111-111111111111" }), (e: any) => e.status === 403);
  await assert.rejects(() => revokeConsent(clientFor(PATIENT, never).supabase, { consentId: "not-a-uuid" }), (e: any) => e.status === 422);
  await assert.rejects(() => revokeConsent(clientFor(PATIENT, async () => ({ data: null, error: { code: "P0002", message: "x" } })).supabase, { consentId: "11111111-1111-1111-1111-111111111111" }), (e: any) => e.status === 404);
  await revokeConsent(clientFor(PATIENT, async () => ({ data: null, error: null })).supabase, { consentId: "11111111-1111-1111-1111-111111111111" });
});

test("listing: patients list their consents; others are refused", async () => {
  const rows = [{ consent_id: "c-1", clinician_name: "Dr One", granted_at: "2026-01-01", revoked_at: null }];
  assert.deepEqual(await listMyConsents(clientFor(PATIENT, async () => ({ data: rows, error: null })).supabase), [{ consentId: "c-1", clinicianName: "Dr One", grantedAt: "2026-01-01", revokedAt: null }]);
  await assert.rejects(() => listMyConsents(clientFor(CLINICIAN, never).supabase), (e: any) => e.status === 403);
});

test("clinician side: only clinicians/students create codes and read shared reports — patients and admins are refused", async () => {
  for (const user of [PATIENT, ADMIN]) {
    await assert.rejects(() => createShareCode(clientFor(user, never).supabase), (e: any) => e.status === 403, `create ${user.id}`);
    await assert.rejects(() => listSharedReports(clientFor(user, never).supabase), (e: any) => e.status === 403, `list ${user.id}`);
  }
  const code = await createShareCode(clientFor(CLINICIAN, async () => ({ data: [{ share_code: "ABCDE-FGHIJ", valid_until: "2026-02-01" }], error: null })).supabase);
  assert.deepEqual(code, { code: "ABCDE-FGHIJ", validUntil: "2026-02-01" });
  const reports = await listSharedReports(clientFor(CLINICIAN, async () => ({ data: [{ report_id: "r1", patient_name: "Pat One", summary: "s", onset: null, severity: "mild", urgency: "soon", created_at: "2026-01-01" }], error: null })).supabase);
  assert.equal(reports[0]?.patientName, "Pat One");
});

test("clinician side: a database error never leaks details", async () => {
  await assert.rejects(() => createShareCode(clientFor(CLINICIAN, async () => ({ data: null, error: { code: "XX", message: "secret" } })).supabase), (e: any) => e.message === "Could not create a sharing code.");
  await assert.rejects(() => listSharedReports(clientFor(CLINICIAN, async () => ({ data: null, error: { code: "XX", message: "secret" } })).supabase), (e: any) => !/secret/.test(e.message));
});
