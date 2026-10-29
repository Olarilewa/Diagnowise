/**
 * Diagnowise core — patient-safe guidance.
 *
 * Turns clinician-facing analysis into what a PATIENT may see. This is the
 * layer that stops "AI says cancer" ever reaching a patient screen:
 *
 *  - It is deterministic. No model writes any patient-facing sentence; the
 *    wording is fixed copy chosen by an urgency tier, so every possible
 *    output can be enumerated, reviewed by a clinician, and tested.
 *  - It never shows a diagnosis or differential. Only short red-flag labels
 *    survive, and only after sanitising (no diagnosis names, no alarming
 *    terms, no over-certain language). A dropped label never lowers urgency.
 *  - Urgency is monotonic: more or worse evidence can raise it, never lower it.
 *  - There is no all-clear. The lowest tier still says it is not a clearance
 *    and still tells the patient when to escalate.
 *  - It fails safe: no analysis (provider down) means "see a clinician soon",
 *    never silence. Emergency phrases in the patient's own text work with no
 *    analysis at all.
 *
 * The fixed copy below is a DRAFT. It needs clinical review, plus
 * localisation, before any real patient sees it.
 */

import { checkOvercertainLanguage } from "../safety/guardrails.js";
import { screenPatientText, type EmergencyScreenResult } from "./emergency-screen.js";

export type Urgency = "routine" | "soon" | "urgent" | "emergency";

/** Structurally satisfied by core's CaseAnalysisResult. */
export interface PatientGuidanceInput {
  redFlags: { label: string; severity: string }[];
  differential: { name: string; dangerous: boolean; likelihood?: string }[];
  missingInformation: string[];
}

export interface PatientGuidance {
  urgency: Urgency;
  mode: "standard" | "crisis";
  headline: string;
  actions: string[];
  /** Plain-language features clinicians take seriously. Never diagnoses. */
  featuresToMention: string[];
  questionsForYourClinician: string[];
  disclaimer: string;
  /** Why this tier was chosen — for audit, not for display. */
  basis: string[];
}

const RANK: Record<Urgency, number> = { routine: 0, soon: 1, urgent: 2, emergency: 3 };
const BY_RANK: Urgency[] = ["routine", "soon", "urgent", "emergency"];

const DISCLAIMER = "This is general guidance based on what you told us. It is not a diagnosis and does not replace a clinician.";
const ESCALATION =
  "If it gets worse, or new symptoms appear, see a clinician sooner. Go to emergency care straight away for chest pain, difficulty breathing, severe bleeding or confusion.";
const BRING_LIST = "Bring a note of your symptoms, when they started, your medications and any previous diagnoses.";

const ALARMING = /\b(cancer\w*|malignan\w*|tumou?r\w*|carcinoma\w*|metasta\w*|lymphoma|leuk(a)?emia|sarcoma|terminal|fatal|death|dying)\b/i;

function severityRank(severity: string): number {
  switch (severity) {
    case "info": return 0;
    case "warning": return 1;
    case "danger": return 2;
    case "critical": return 3;
    default: return 1; // unknown severity: fail safe, not silent
  }
}

function analysisRank(a: PatientGuidanceInput): number {
  let rank = 0;
  for (const f of a.redFlags) rank = Math.max(rank, severityRank(f.severity));
  for (const d of a.differential) {
    if (d.dangerous && (d.likelihood === "moderate" || d.likelihood === "high")) rank = Math.max(rank, 1);
  }
  return rank;
}

/** Returns the text if safe to show a patient, else null. Exported for testing. */
export function sanitizePatientFacingText(text: string, diagnosisNames: string[]): string | null {
  const t = text.trim();
  if (t.length === 0 || t.length > 120) return null;
  if (ALARMING.test(t)) return null;
  const lower = t.toLowerCase();
  for (const name of diagnosisNames) {
    const n = name.trim().toLowerCase();
    if (n.length >= 3 && lower.includes(n)) return null;
  }
  if (checkOvercertainLanguage(t).length > 0) return null;
  return t;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.toLowerCase()) ? false : (seen.add(i.toLowerCase()), true)));
}
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildPatientGuidance(input: { analysis?: PatientGuidanceInput | null; patientText?: string }): PatientGuidance {
  const screen: EmergencyScreenResult = input.patientText ? screenPatientText(input.patientText) : { triggered: false, matched: [] };
  const basis: string[] = [];

  if (screen.category === "crisis") {
    return {
      urgency: "emergency",
      mode: "crisis",
      headline: "You don't have to face this alone, and help is available right now.",
      actions: [
        "Contact your local emergency number or a crisis line in your country right now.",
        "If you can, tell someone near you how you're feeling and ask them to stay with you.",
        "If you've taken something that could harm you, get emergency care immediately.",
      ],
      featuresToMention: [],
      questionsForYourClinician: [],
      disclaimer: "",
      basis: ["screen:crisis"],
    };
  }

  let rank = 0;
  if (screen.category === "medical") { rank = 3; basis.push("screen:medical"); }
  else if (screen.category === "urgent") { rank = 2; basis.push("screen:urgent"); }

  let fallback = false;
  if (input.analysis) {
    const r = analysisRank(input.analysis);
    if (r > 0) basis.push(`analysis:${BY_RANK[r]}`);
    rank = Math.max(rank, r);
  } else {
    fallback = true;
    rank = Math.max(rank, 1);
    basis.push("fallback:no-analysis");
  }
  if (basis.length === 0) basis.push("analysis:no-warning-signs");

  const urgency = BY_RANK[rank]!;

  if (urgency === "emergency") {
    return {
      urgency, mode: "standard",
      headline: "What you've described may need emergency care right now.",
      actions: [
        "Call your local emergency number or go to the nearest emergency department now.",
        "If you can, have someone with you, and don't drive yourself.",
        "Tell the emergency team exactly what you've been experiencing.",
      ],
      featuresToMention: [], questionsForYourClinician: [], disclaimer: DISCLAIMER, basis,
    };
  }

  const names = input.analysis?.differential.map((d) => d.name) ?? [];

  let featuresToMention: string[] = [];
  if (input.analysis) {
    const flagged = input.analysis.redFlags.filter((f) => severityRank(f.severity) >= 1);
    const safe = dedupe(flagged.map((f) => sanitizePatientFacingText(f.label, names)).filter((x): x is string => x !== null).map(capitalise)).slice(0, 4);
    featuresToMention = safe.length > 0 || flagged.length === 0 ? safe : ["Some features of what you've described are ones clinicians take seriously."];
  }

  const questions = input.analysis
    ? dedupe(
        input.analysis.missingInformation
          .map((q) => sanitizePatientFacingText(q, names))
          .filter((q): q is string => q !== null && q.endsWith("?"))
      ).slice(0, 4)
    : [];

  const copy: Record<"urgent" | "soon" | "routine", { headline: string; first: string }> = {
    urgent: { headline: "Please get this checked by a clinician within the next day or so.", first: "Contact a clinician today, or within the next day, to be seen in person." },
    soon: { headline: "Please arrange to see a clinician in the next few days.", first: "Book an appointment with a clinician in the next few days." },
    routine: {
      headline: "We didn't pick up warning signs in what you shared, but this isn't a clearance. Only a clinician who examines you can say that.",
      first: "Mention this at your next appointment, or book one if it continues.",
    },
  };
  const c = copy[urgency];
  return {
    urgency, mode: "standard",
    // The no-analysis wording only fits the "soon" tier: if an emergency-screen phrase
    // already raised urgency, that tier's own (more urgent) headline must win.
    headline: fallback && urgency === "soon" ? "We couldn't fully assess this, so please speak to a clinician in the next few days." : c.headline,
    actions: [c.first, ESCALATION, BRING_LIST],
    featuresToMention, questionsForYourClinician: questions, disclaimer: DISCLAIMER, basis,
  };
}
