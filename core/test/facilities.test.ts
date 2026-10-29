import { test } from "node:test";
import assert from "node:assert/strict";
import { coarsenLocation, distanceKm } from "../src/facilities/geo.js";
import { DISTANCE_BANDS_KM, criteriaMet, recommendFacilities } from "../src/facilities/recommend.js";
import type { Facility, GeoPoint, RecommendationInput } from "../src/facilities/types.js";

const ORIGIN: GeoPoint = { lat: 6.5, lon: 3.4 };
const src = { source: "Test registry", verifiedAt: "2026-01-01" };

/** Move roughly `km` north of the origin. */
const at = (km: number): GeoPoint => ({ lat: ORIGIN.lat + km / 111.19, lon: ORIGIN.lon });

function fac(id: string, o: Partial<Facility> & { km?: number; criteria?: number; specialty?: string } = {}): Facility {
  const specialty = o.specialty ?? "Gastroenterology";
  const c = o.criteria ?? 0;
  return {
    id, name: o.name ?? `Facility ${id}`, countryCode: "NG", location: o.location ?? at(o.km ?? 10),
    emergencyCapable: o.emergencyCapable ?? false, emergencySource: o.emergencySource,
    services: o.services ?? [{ specialty, dedicatedUnit: c >= 2, unitSource: c >= 2 ? src : undefined, publishedOutcomes: c >= 3 ? src : undefined }],
    accreditations: o.accreditations ?? (c >= 1 ? [{ body: "Test Accreditor", source: src }] : []),
    centerOfExcellence: o.centerOfExcellence ?? [],
    diagnowiseConnection: o.diagnowiseConnection ?? "none",
  };
}
const ed = (id: string, km: number, extra: Partial<Facility> = {}) => fac(id, { km, emergencyCapable: true, emergencySource: src, ...extra });
const input = (facilities: Facility[], o: Partial<RecommendationInput> = {}): RecommendationInput => ({ urgency: "soon", specialty: "Gastroenterology", location: ORIGIN, facilities, ...o });
const ids = (r: { facility: Facility }[]) => r.map((x) => x.facility.id);

// deterministic PRNG so property tests are reproducible
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomFacilities(r: () => number, n: number, o: { emergency?: boolean } = {}): Facility[] {
  return Array.from({ length: n }, (_, i) => fac(`f${i}`, {
    km: Math.round(r() * 90), criteria: Math.floor(r() * 4), diagnowiseConnection: r() < 0.5 ? "can_receive_reports" : "none",
    emergencyCapable: o.emergency ? r() < 0.7 : false, emergencySource: o.emergency ? src : undefined,
    centerOfExcellence: r() < 0.4 ? [{ specialty: "Gastroenterology", designation: "National referral centre", source: src }] : [],
  }));
}
const flip = (fs: Facility[], v: Facility["diagnowiseConnection"]) => fs.map((f) => ({ ...f, diagnowiseConnection: v }));

// ---------------- emergency / crisis ----------------
test("emergency: only sourced emergency departments, nearest first, at most 3 — quality is irrelevant", () => {
  const r = recommendFacilities(input([ed("far", 30), ed("near", 2), ed("mid", 9), ed("also", 12), fac("great-but-no-ed", { km: 1, criteria: 3 })], { urgency: "emergency" }));
  assert.equal(r.kind, "emergency");
  assert.deepEqual(r.nearestEmergency.map((e) => e.id), ["near", "mid", "also"]);
  assert.deepEqual(r.nearbyCapable, []);
  assert.deepEqual(r.centersOfExcellence, []);
});

test("emergency options carry no quality or Diagnowise-connection data at all", () => {
  const r = recommendFacilities(input([ed("a", 3, { diagnowiseConnection: "can_receive_reports" })], { urgency: "emergency" }));
  assert.deepEqual(Object.keys(r.nearestEmergency[0]!).sort(), ["distanceKm", "id", "location", "name"]);
});

test("emergency: an emergency claim with no source is not trusted", () => {
  const unsourced = fac("x", { km: 1, emergencyCapable: true });
  assert.equal(recommendFacilities(input([unsourced], { urgency: "emergency" })).nearestEmergency.length, 0);
});

test("emergency: with nothing found it says so, tells the patient to call, and reports thin data", () => {
  const r = recommendFacilities(input([], { urgency: "emergency" }));
  assert.equal(r.dataQuality, "thin");
  assert.match(r.notes.join(" "), /couldn't find a listed emergency department/);
  assert.match(r.notes[0]!, /call your local emergency number/i);
});

test("crisis is handled like an emergency, whatever the urgency tier says", () => {
  const r = recommendFacilities(input([ed("a", 4), fac("b", { km: 1, criteria: 3 })], { urgency: "routine", crisis: true }));
  assert.equal(r.kind, "crisis");
  assert.deepEqual(r.nearestEmergency.map((e) => e.id), ["a"]);
  assert.deepEqual(r.nearbyCapable, []);
});

test("PROPERTY: Diagnowise-connection status can NEVER change an emergency result", () => {
  const r = rng(11);
  for (let i = 0; i < 200; i++) {
    const fs = randomFacilities(r, 1 + Math.floor(r() * 9), { emergency: true });
    const base = (urgency: "emergency", crisis = false) => recommendFacilities(input(fs, { urgency, crisis }));
    assert.deepEqual(base("emergency"), recommendFacilities(input(flip(fs, "can_receive_reports"), { urgency: "emergency" })));
    assert.deepEqual(base("emergency"), recommendFacilities(input(flip(fs, "none"), { urgency: "emergency" })));
    assert.deepEqual(base("emergency", true), recommendFacilities(input(flip(fs, "can_receive_reports"), { urgency: "emergency", crisis: true })));
  }
});

test("the emergency line is always the first note, in every kind of result", () => {
  for (const o of [{ urgency: "emergency" as const }, { urgency: "soon" as const, crisis: true }, { urgency: "routine" as const }, { urgency: "soon" as const, specialty: undefined }]) {
    assert.match(recommendFacilities(input([fac("a")], o)).notes[0]!, /call your local emergency number/i);
  }
});

// ---------------- standard ranking: quality first, connection last ----------------
test("quality outranks connection: a better facility that cannot receive reports beats a worse one that can", () => {
  const r = recommendFacilities(input([fac("connected-weak", { km: 3, criteria: 1, diagnowiseConnection: "can_receive_reports" }), fac("plain-strong", { km: 4, criteria: 3 })]));
  assert.deepEqual(ids(r.nearbyCapable), ["plain-strong", "connected-weak"]);
  assert.ok(r.nearbyCapable.every((x) => !x.connectionBrokeATie));
  assert.ok(!r.notes.join(" ").includes("can receive your Diagnowise report"));
});

test("a nearer distance band outranks connection", () => {
  const r = recommendFacilities(input([fac("connected-far", { km: 20, criteria: 2, diagnowiseConnection: "can_receive_reports" }), fac("plain-near", { km: 3, criteria: 2 })]));
  assert.deepEqual(ids(r.nearbyCapable), ["plain-near", "connected-far"]);
});

test("connection decides ONLY between equals — and when it does, the patient is told", () => {
  const r = recommendFacilities(input([fac("plain", { km: 6, criteria: 2 }), fac("connected", { km: 9, criteria: 2, diagnowiseConnection: "can_receive_reports" })]));
  assert.deepEqual(ids(r.nearbyCapable), ["connected", "plain"]);
  assert.equal(r.nearbyCapable[0]!.connectionBrokeATie, true);
  assert.ok(r.nearbyCapable[0]!.reasons.some((x) => /otherwise equivalent/.test(x)));
  assert.match(r.notes.join(" "), /No facility pays to be ranked/);
});

test("connection that changes nothing is not claimed as a reason", () => {
  const r = recommendFacilities(input([fac("connected", { km: 6, criteria: 2, diagnowiseConnection: "can_receive_reports" }), fac("plain", { km: 9, criteria: 2 })]));
  assert.deepEqual(ids(r.nearbyCapable), ["connected", "plain"]);
  assert.equal(r.nearbyCapable[0]!.connectionBrokeATie, false);
});

test("PROPERTY: connection only reorders facilities that are exactly equal on quality and distance band", () => {
  const key = (f: Facility, spec: string) => `${criteriaMet(f, spec).length}|${DISTANCE_BANDS_KM.findIndex((b) => distanceKm(ORIGIN, f.location) < b)}`;
  const r = rng(7);
  let ties = 0;
  for (let i = 0; i < 300; i++) {
    const fs = randomFacilities(r, 2 + Math.floor(r() * 6));
    const withConn = recommendFacilities(input(fs));
    const without = recommendFacilities(input(flip(fs, "none")));
    const seq = (res: typeof withConn) => res.nearbyCapable.map((x) => key(x.facility, "Gastroenterology"));
    assert.deepEqual(seq(withConn), seq(without), "the (quality, band) sequence must be identical");
    assert.deepEqual([...ids(withConn.nearbyCapable)].sort(), [...ids(without.nearbyCapable)].sort());
    ties += withConn.nearbyCapable.filter((x) => x.connectionBrokeATie).length;
  }
  assert.ok(ties > 20, `the generator should exercise the tie-break (got ${ties})`);
});

test("PROPERTY: a facility with strictly more sourced criteria is never ranked below one with fewer because of connection", () => {
  const r = rng(99);
  for (let i = 0; i < 300; i++) {
    const res = recommendFacilities(input(randomFacilities(r, 2 + Math.floor(r() * 6)))).nearbyCapable;
    for (let a = 0; a < res.length; a++) for (let b = a + 1; b < res.length; b++) assert.ok(res[a]!.criteriaMet.length >= res[b]!.criteriaMet.length);
  }
});

// ---------------- evidence rules ----------------
test("claims without a source earn no credit", () => {
  const unsourcedUnit = fac("u", { services: [{ specialty: "Gastroenterology", dedicatedUnit: true }] });
  const blankAccreditation = fac("a", { accreditations: [{ body: "Someone", source: { source: "  ", verifiedAt: "2026-01-01" } }] });
  assert.deepEqual(criteriaMet(unsourcedUnit, "Gastroenterology"), []);
  assert.deepEqual(criteriaMet(blankAccreditation, "Gastroenterology"), []);
  assert.deepEqual(criteriaMet(fac("s", { criteria: 3 }), "gastroenterology"), ["Accredited by Test Accreditor", "Has a dedicated gastroenterology unit", "Publishes outcomes for gastroenterology"]);
});

test("TYPE GUARD: a Facility cannot carry a commercial field (this line must fail to compile if one is ever added)", () => {
  // @ts-expect-error — `plan` is not part of Facility, and must never be.
  const sneaky: Facility = { ...fac("x"), plan: "gold" };
  assert.ok(sneaky);
});

// ---------------- filters, limits, thin data ----------------
test("specialty match is case-insensitive; facilities without the service are excluded; distance caps follow urgency", () => {
  const fs = [fac("yes", { km: 20 }), fac("wrong-specialty", { km: 5, specialty: "Cardiology" }), fac("too-far-for-urgent", { km: 80 })];
  assert.deepEqual(ids(recommendFacilities(input(fs, { specialty: "gastroenterology" })).nearbyCapable), ["yes", "too-far-for-urgent"]);
  assert.deepEqual(ids(recommendFacilities(input(fs, { urgency: "urgent" })).nearbyCapable), ["yes"]);
});

test("thin data is reported as thin; a missing specialty asks for one rather than guessing", () => {
  const thin = recommendFacilities(input([fac("only", { km: 5 })]));
  assert.equal(thin.dataQuality, "thin");
  assert.match(thin.notes.join(" "), /limited information for your area/);
  const none = recommendFacilities(input([fac("a")], { specialty: undefined }));
  assert.equal(none.dataQuality, "thin");
  assert.deepEqual(none.nearbyCapable, []);
});

// ---------------- centers of excellence ----------------
const coe = (id: string, o: Partial<Facility> & { km?: number; criteria?: number } = {}) =>
  fac(id, { ...o, centerOfExcellence: [{ specialty: "Gastroenterology", designation: "National referral centre", source: src }] });

test("centers of excellence: only for routine/soon complex conditions, with the cost-and-travel caveat", () => {
  const fs = [coe("a", { km: 500, criteria: 2 }), fac("not-a-center", { km: 5, criteria: 3 })];
  const r = recommendFacilities(input(fs, { complexCondition: true }));
  assert.deepEqual(ids(r.centersOfExcellence), ["a"]);
  assert.match(r.notes.join(" "), /Talk to your clinician before planning any travel/);
  assert.deepEqual(recommendFacilities(input(fs, { complexCondition: false })).centersOfExcellence, []);
  assert.deepEqual(recommendFacilities(input(fs, { complexCondition: true, urgency: "urgent" })).centersOfExcellence, []);
  assert.deepEqual(recommendFacilities(input(fs, { complexCondition: true, urgency: "emergency" })).centersOfExcellence, []);
});

test("centers of excellence need a sourced designation", () => {
  const unsourced = fac("u", { centerOfExcellence: [{ specialty: "Gastroenterology", designation: "Self-declared", source: { source: "", verifiedAt: "2026-01-01" } }] });
  assert.deepEqual(recommendFacilities(input([unsourced], { complexCondition: true })).centersOfExcellence, []);
});

test("PROPERTY: centers are ordered by quality then name — never by distance or Diagnowise connection", () => {
  const r = rng(5);
  for (let i = 0; i < 200; i++) {
    const fs = randomFacilities(r, 2 + Math.floor(r() * 6));
    const a = recommendFacilities(input(fs, { complexCondition: true })).centersOfExcellence;
    assert.deepEqual(ids(a), ids(recommendFacilities(input(flip(fs, "can_receive_reports"), { complexCondition: true })).centersOfExcellence));
    assert.deepEqual(ids(a), ids(recommendFacilities(input(flip(fs, "none"), { complexCondition: true })).centersOfExcellence));
  }
});

// ---------------- geo ----------------
test("geo: distance is sane, locations are coarsened, bad coordinates are rejected", () => {
  const km = distanceKm({ lat: 6.5244, lon: 3.3792 }, { lat: 9.0765, lon: 7.3986 });
  assert.ok(km > 520 && km < 550, `Lagos-Abuja was ${km}`);
  assert.deepEqual(coarsenLocation({ lat: 6.52441, lon: 3.37919 }), { lat: 6.5, lon: 3.4 });
  assert.throws(() => coarsenLocation({ lat: 91, lon: 0 }), RangeError);
  assert.throws(() => distanceKm({ lat: NaN, lon: 0 }, ORIGIN), RangeError);
});
