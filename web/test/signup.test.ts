import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase";
import { handleCompleteOnboarding } from "../lib/signup/complete-onboarding";
import { parseSignupIntent } from "../lib/signup/schemas";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
function stub(role = "clinician", rpcImpl: () => RpcResult = () => ({ data: "org-1", error: null }), updateError: { message: string } | null = null) {
  const user = { id: "u-1", email: "u@x.org" };
  const base = createFakeSupabase({ authUser: user, tables: { users: [{ id: user.id, role, name: "U", email: user.email, specialty: null }] } });
  const rpcCalls: { name: string; args: any }[] = [];
  const updates: any[] = [];
  const supabase = {
    ...base,
    from: (t: string) => (t === "users" ? { ...base.from("users"), update: (v: unknown) => ({ eq: async () => { updates.push(v); return { error: updateError }; } }) } : base.from(t)),
    rpc: async (name: string, args: any) => { rpcCalls.push({ name, args }); return rpcImpl(); },
  } as any;
  return { supabase, rpcCalls, updates };
}

test("hospital sign-up: creates the organization as hospital_admin with its facility type, then saves the specialty", async () => {
  const s = stub("clinician");
  const r = await handleCompleteOnboarding(s.supabase, { role: "hospital_admin", specialty: "Administration", organizationName: "Lagos Eye Centre", organizationType: "clinic", country: "Nigeria", careScope: "specialist", careScopeDetail: "Ophthalmology" });
  assert.deepEqual(r, { redirectTo: "/hospital" });
  assert.deepEqual(s.rpcCalls, [{ name: "create_organization", args: { p_name: "Lagos Eye Centre", p_type: "clinic", p_country: "Nigeria", p_care_scope: "specialist", p_care_scope_detail: "Ophthalmology", p_role: "hospital_admin" } }]);
  assert.deepEqual(s.updates, [{ specialty: "Administration" }]);
});

test("clinician: stays a clinician and goes to the dashboard", async () => {
  const s = stub();
  const r = await handleCompleteOnboarding(s.supabase, { role: "clinician", specialty: "Internal Medicine", organizationName: "Northbridge General" });
  assert.deepEqual(r, { redirectTo: "/dashboard" });
  assert.equal(s.rpcCalls[0]?.args.p_role, "clinician");
  assert.equal(s.rpcCalls[0]?.args.p_type, "hospital");
});

test("researcher: no organization is created, and the role is set directly", async () => {
  const s = stub();
  const r = await handleCompleteOnboarding(s.supabase, { role: "researcher", specialty: "Epidemiology" });
  assert.deepEqual(r, { redirectTo: "/dashboard" });
  assert.equal(s.rpcCalls.length, 0);
  assert.deepEqual(s.updates, [{ role: "researcher", specialty: "Epidemiology" }]);
});

test("validation happens before anything is written", async () => {
  for (const bad of [
    { role: "hospital_admin", specialty: "Administration", organizationName: "Lagos Eye Centre", careScope: "specialist" },
    { role: "hospital_admin", specialty: "Administration", organizationName: "Lagos Eye Centre", careScope: "other", careScopeDetail: "   " },
    { role: "clinician", specialty: "IM", organizationName: "X" },
    { role: "patient", specialty: "IM", organizationName: "Hospital" },
    { role: "clinician", specialty: "", organizationName: "Hospital" },
  ] as any[]) {
    const s = stub();
    const r = await handleCompleteOnboarding(s.supabase, bad);
    assert.ok(r.error, JSON.stringify(bad));
    assert.equal(s.rpcCalls.length + s.updates.length, 0, JSON.stringify(bad));
  }
  const s = stub();
  assert.match((await handleCompleteOnboarding(s.supabase, { role: "clinician", specialty: "IM" })).error ?? "", /organization name is required/);
});

test("a patient account is refused and nothing is written", async () => {
  const s = stub("patient");
  const r = await handleCompleteOnboarding(s.supabase, { role: "clinician", specialty: "IM", organizationName: "Some Hospital" });
  assert.match(r.error ?? "", /don't need this step/);
  assert.equal(s.rpcCalls.length + s.updates.length, 0);
});

test("database errors become friendly messages that leak nothing, and the specialty is not saved after a failed creation", async () => {
  const already = stub("clinician", () => ({ data: null, error: { code: "P0001", message: "You already belong to an organization." } }));
  assert.match((await handleCompleteOnboarding(already.supabase, { role: "clinician", specialty: "IM", organizationName: "Hospital" })).error ?? "", /already set up/);
  const other = stub("clinician", () => ({ data: null, error: { code: "XX000", message: "relation organizations secret detail" } }));
  const r = await handleCompleteOnboarding(other.supabase, { role: "clinician", specialty: "IM", organizationName: "Hospital" });
  assert.match(r.error ?? "", /couldn't set up your organization/);
  assert.ok(!/secret|relation|XX000/.test(r.error ?? ""));
  assert.equal(other.updates.length, 0);
  const noSave = stub("clinician", undefined, { message: "db secret" });
  const r2 = await handleCompleteOnboarding(noSave.supabase, { role: "clinician", specialty: "IM", organizationName: "Hospital" });
  assert.match(r2.error ?? "", /couldn't save your profile/);
  assert.ok(!/secret/.test(r2.error ?? ""));
});

test("sign-up intent: valid shapes are accepted and trimmed", () => {
  assert.deepEqual(parseSignupIntent({ intent: "patient", name: "ignored" }), { intent: "patient" });
  assert.deepEqual(parseSignupIntent({ intent: "clinician", workplace_name: "  Northbridge General  " }), { intent: "clinician", workplace_name: "Northbridge General" });
  assert.deepEqual(parseSignupIntent({ intent: "hospital", hospital_name: "Lagos Eye Centre", care_scope: "specialist", care_scope_detail: " Ophthalmology ", country: "Nigeria" }), {
    intent: "hospital", hospital_name: "Lagos Eye Centre", institution_type: "hospital", care_scope: "specialist", care_scope_detail: "Ophthalmology", country: "Nigeria",
  });
});

test("sign-up intent: anything malformed, unknown or hostile yields null — and a role can never be smuggled in", () => {
  for (const bad of [null, undefined, "hospital", 42, [], {}, { intent: "admin" }, { intent: "clinician" }, { intent: "clinician", workplace_name: "X" },
    { intent: "hospital", hospital_name: "Lagos Eye Centre" }, { intent: "hospital", hospital_name: "Lagos Eye Centre", care_scope: "specialist" },
    { intent: "hospital", hospital_name: "Lagos Eye Centre", care_scope: "everything" }, { intent: "hospital", hospital_name: "x".repeat(201), care_scope: "general" }]) {
    assert.equal(parseSignupIntent(bad), null, JSON.stringify(bad));
  }
  const sneaky = parseSignupIntent({ intent: "hospital", hospital_name: "Lagos Eye Centre", care_scope: "general", role: "hospital_admin", user_role: "admin" });
  assert.ok(sneaky && !("role" in sneaky) && !("user_role" in sneaky));
});
