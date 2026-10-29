/**
 * Diagnowise core — facility directory types.
 *
 * DESIGN RULE, enforced by the shape of this file: nothing commercial can enter
 * a ranking. `Facility` has no plan, price, billing, contract or "customer"
 * field, so recommend.ts cannot read one even by accident. The only
 * Diagnowise-related field is `diagnowiseConnection`, and it records a
 * CAPABILITY (this facility can receive a patient-shared report), granted by
 * completing technical onboarding — never by paying.
 *
 * Every quality claim carries a source. A claim without one earns no credit.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SourcedClaim {
  /** Human-readable origin, e.g. "National Health Facility Registry" or "OpenStreetMap". */
  source: string;
  url?: string;
  /** ISO date this was last checked. */
  verifiedAt: string;
}

export interface FacilityService {
  specialty: string;
  /** A dedicated unit/department for this specialty. Credited only with `unitSource`. */
  dedicatedUnit: boolean;
  unitSource?: SourcedClaim;
  /** Published outcome or volume data for this specialty. Credited only when present. */
  publishedOutcomes?: SourcedClaim;
}

export interface Facility {
  id: string;
  name: string;
  countryCode: string;
  location: GeoPoint;
  /** Staffed emergency department. Credited only with `emergencySource`. */
  emergencyCapable: boolean;
  emergencySource?: SourcedClaim;
  services: FacilityService[];
  accreditations: { body: string; source: SourcedClaim }[];
  /** Referral-level designations (curated, cited). Used only for the "centers of excellence" list. */
  centerOfExcellence: { specialty: string; designation: string; source: SourcedClaim }[];
  /** Capability only. See the design rule above. */
  diagnowiseConnection: "can_receive_reports" | "none";
}

export type Urgency = "routine" | "soon" | "urgent" | "emergency";

export interface RecommendationInput {
  urgency: Urgency;
  /** True when patient-safe guidance ran in crisis mode. Treated like emergency: nearest emergency care only. */
  crisis?: boolean;
  /** The kind of care needed, e.g. "Gastroenterology". Required for the non-emergency lists. */
  specialty?: string;
  /** Already coarsened: see coarsenLocation(). */
  location: GeoPoint;
  /** Only meaningful for routine/soon: also list referral-level centers of excellence. */
  complexCondition?: boolean;
  facilities: Facility[];
}

/** Deliberately narrow: an emergency option carries no quality, ranking or Diagnowise-connection data. */
export interface EmergencyOption {
  id: string;
  name: string;
  location: GeoPoint;
  distanceKm: number;
}

export interface RankedFacility {
  facility: Facility;
  distanceKm: number;
  /** Which sourced criteria this facility meets, in plain words. */
  criteriaMet: string[];
  /** Why it is listed where it is — shown to the patient. */
  reasons: string[];
  canReceiveReport: boolean;
  /** True only when "can receive your report" actually moved it above an otherwise-equivalent facility. */
  connectionBrokeATie: boolean;
}

export interface Recommendation {
  kind: "emergency" | "crisis" | "standard";
  nearestEmergency: EmergencyOption[];
  nearbyCapable: RankedFacility[];
  centersOfExcellence: RankedFacility[];
  /** Shown to the patient, in order. Always starts with the emergency line. */
  notes: string[];
  dataQuality: "ok" | "thin";
}
