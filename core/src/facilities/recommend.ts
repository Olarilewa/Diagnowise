/**
 * Diagnowise core — facility recommendation.
 *
 * Pure and deterministic: same input, same output; no network, no model, no
 * clock. Every ordering decision is explainable in one sentence, and the
 * explanation is returned with the result.
 *
 * Rules (each one has a test):
 *
 *  1. EMERGENCY / CRISIS: only the nearest emergency-capable facilities, by
 *     distance. No quality ranking, no "best", no centers of excellence, and no
 *     Diagnowise-connection data at all (EmergencyOption cannot carry it). When
 *     it matters most, the answer is simply "nearest".
 *  2. Otherwise facilities are ordered by, in this precedence:
 *       a. how many SOURCED quality criteria they meet (more first),
 *       b. distance band (nearer band first),
 *       c. whether they can receive the patient's Diagnowise report,
 *       d. exact distance, then name (so output is deterministic).
 *     So (c) can only reorder facilities that are EQUAL on (a) and (b). A
 *     facility that can receive reports can never outrank one that is better
 *     on quality or in a nearer band, and nothing in `Facility` is commercial.
 *  3. When (c) actually changed an order, the result says so, in words the
 *     patient sees. The effect is never hidden.
 *  4. Centers of excellence are listed only for routine/soon care with a
 *     complex condition, ordered by criteria then name — never by distance or
 *     connection — with the cost/travel caveat attached.
 *  5. Thin data is reported as thin instead of presented as a confident list.
 */

import { distanceKm } from "./geo.js";
import type { EmergencyOption, Facility, RankedFacility, Recommendation, RecommendationInput, Urgency } from "./types.js";

export const DISTANCE_BANDS_KM = [5, 15, 50] as const;
const MAX_DISTANCE_KM: Record<Exclude<Urgency, "emergency">, number> = { urgent: 50, soon: 100, routine: 200 };
const MAX_EMERGENCY_OPTIONS = 3;
const MAX_NEARBY = 8;
const MAX_CENTERS = 5;
const THIN_THRESHOLD = 2;

const EMERGENCY_LINE = "If this is an emergency, call your local emergency number now. Don't wait for directions.";
const TIE_BREAK_DISCLOSURE =
  "Where two facilities were otherwise equivalent, we listed first the one that can receive your Diagnowise report. No facility pays to be ranked.";
const CENTERS_CAVEAT =
  "These are referral-level centers for complex conditions. Cost, travel and eligibility apply, and a referral is usually needed. Talk to your clinician before planning any travel.";

const norm = (s: string) => s.trim().toLowerCase();
const bandOf = (km: number) => {
  const i = DISTANCE_BANDS_KM.findIndex((b) => km < b);
  return i === -1 ? DISTANCE_BANDS_KM.length : i;
};

/** Sourced criteria only: a claim with no source earns nothing. */
export function criteriaMet(f: Facility, specialty: string): string[] {
  const met: string[] = [];
  const accreditation = f.accreditations.find((a) => a.source.source.trim().length > 0);
  if (accreditation) met.push(`Accredited by ${accreditation.body}`);
  const service = f.services.find((s) => norm(s.specialty) === norm(specialty));
  if (service?.dedicatedUnit && service.unitSource) met.push(`Has a dedicated ${specialty} unit`);
  if (service?.publishedOutcomes) met.push(`Publishes outcomes for ${specialty}`);
  return met;
}

function nearestEmergency(input: RecommendationInput): EmergencyOption[] {
  return input.facilities
    .filter((f) => f.emergencyCapable && f.emergencySource)
    .map((f) => ({ id: f.id, name: f.name, location: f.location, distanceKm: distanceKm(input.location, f.location) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name))
    .slice(0, MAX_EMERGENCY_OPTIONS);
}

interface Candidate {
  facility: Facility;
  distanceKm: number;
  criteria: string[];
  band: number;
  canReceive: boolean;
}

function order(cands: Candidate[], useConnection: boolean): Candidate[] {
  return [...cands].sort(
    (a, b) =>
      b.criteria.length - a.criteria.length ||
      a.band - b.band ||
      (useConnection ? Number(b.canReceive) - Number(a.canReceive) : 0) ||
      a.distanceKm - b.distanceKm ||
      a.facility.name.localeCompare(b.facility.name) ||
      a.facility.id.localeCompare(b.facility.id)
  );
}

function rankNearby(input: RecommendationInput, specialty: string, maxKm: number): RankedFacility[] {
  const cands: Candidate[] = input.facilities
    .filter((f) => f.services.some((s) => norm(s.specialty) === norm(specialty)))
    .map((f) => {
      const d = distanceKm(input.location, f.location);
      return { facility: f, distanceKm: d, criteria: criteriaMet(f, specialty), band: bandOf(d), canReceive: f.diagnowiseConnection === "can_receive_reports" };
    })
    .filter((c) => c.distanceKm <= maxKm);

  const actual = order(cands, true);
  const neutral = order(cands, false);
  const neutralPos = new Map(neutral.map((c, i) => [c.facility.id, i]));

  return actual.slice(0, MAX_NEARBY).map((c, i) => {
    const broke = c.canReceive && i < (neutralPos.get(c.facility.id) ?? i);
    const reasons = [...c.criteria];
    if (c.criteria.length === 0) reasons.push("Offers this kind of care (no further quality information available)");
    reasons.push(`About ${Math.round(c.distanceKm)} km away`);
    if (broke) reasons.push("Listed ahead of an otherwise equivalent facility because it can receive your Diagnowise report");
    return { facility: c.facility, distanceKm: c.distanceKm, criteriaMet: c.criteria, reasons, canReceiveReport: c.canReceive, connectionBrokeATie: broke };
  });
}

function rankCenters(input: RecommendationInput, specialty: string): RankedFacility[] {
  return input.facilities
    .map((f) => ({ f, designation: f.centerOfExcellence.find((c) => norm(c.specialty) === norm(specialty) && c.source.source.trim().length > 0) }))
    .filter((x): x is { f: Facility; designation: NonNullable<typeof x.designation> } => x.designation !== undefined)
    .map(({ f, designation }) => {
      const criteria = criteriaMet(f, specialty);
      return {
        facility: f,
        distanceKm: distanceKm(input.location, f.location),
        criteriaMet: criteria,
        reasons: [`${designation.designation} (source: ${designation.source.source})`, ...criteria],
        canReceiveReport: f.diagnowiseConnection === "can_receive_reports",
        connectionBrokeATie: false,
      };
    })
    .sort((a, b) => b.criteriaMet.length - a.criteriaMet.length || a.facility.name.localeCompare(b.facility.name) || a.facility.id.localeCompare(b.facility.id))
    .slice(0, MAX_CENTERS);
}

export function recommendFacilities(input: RecommendationInput): Recommendation {
  if (input.urgency === "emergency" || input.crisis) {
    const nearest = nearestEmergency(input);
    const notes = [EMERGENCY_LINE];
    if (nearest.length === 0) notes.push("We couldn't find a listed emergency department near you. Call your local emergency number now.");
    return { kind: input.crisis ? "crisis" : "emergency", nearestEmergency: nearest, nearbyCapable: [], centersOfExcellence: [], notes, dataQuality: nearest.length === 0 ? "thin" : "ok" };
  }

  const notes = [EMERGENCY_LINE];
  const specialty = input.specialty?.trim();
  if (!specialty) {
    notes.push("Tell us what kind of care is needed to see facilities that offer it.");
    return { kind: "standard", nearestEmergency: [], nearbyCapable: [], centersOfExcellence: [], notes, dataQuality: "thin" };
  }

  const nearby = rankNearby(input, specialty, MAX_DISTANCE_KM[input.urgency]);
  const centers = input.complexCondition && (input.urgency === "routine" || input.urgency === "soon") ? rankCenters(input, specialty) : [];

  if (nearby.some((n) => n.connectionBrokeATie)) notes.push(TIE_BREAK_DISCLOSURE);
  if (centers.length > 0) notes.push(CENTERS_CAVEAT);
  const thin = nearby.length < THIN_THRESHOLD;
  if (thin) notes.push("Our directory has limited information for your area. Please also ask your clinician or local health authority where to go.");

  return { kind: "standard", nearestEmergency: [], nearbyCapable: nearby, centersOfExcellence: centers, notes, dataQuality: thin ? "thin" : "ok" };
}
