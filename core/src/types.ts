/**
 * Diagnowise core — shared types.
 *
 * These are the pipeline's vocabulary (build doc §27's 10 stages, condensed
 * to 7 independently-callable, independently-loggable functions — see
 * orchestrator.ts's docstring for exactly how the condensing works and why).
 *
 * Nothing in this file, or anywhere in core/, imports from a database client
 * or a specific AI provider's SDK. That's the whole point of core/ being
 * extractable (strategy doc §30): it takes structured input, returns
 * structured output, and the caller (web/lib/ai/) decides what to persist
 * and which provider to use.
 */

export type PipelineStage =
  | "extraction_normalization"
  | "red_flag_detection"
  | "differential_generation"
  | "contradiction_detection"
  | "missing_information_analysis"
  | "investigation_considerations"
  | "follow_up_reasoning"
  | "safety_verification"
  | "patient_explanation";

export type Likelihood = "low" | "moderate" | "high";
export type RedFlagSeverity = "info" | "warning" | "danger" | "critical";
export type EvidenceSource = "patient" | "clinician";

/** Everything the pipeline knows about a case before analysis runs. */
export interface ClinicalContext {
  caseId: string;
  patient: { age: number; sex: "male" | "female" | "other" | "unspecified" };
  presentingComplaint: string;
  /** Answers to clarifying questions, prior symptoms, etc. — always attributed. */
  history: { label: string; value: string; source: EvidenceSource }[];
  workingDiagnosis?: string;
}

/** Stage 1+2: extraction + normalization. */
export interface NormalizedClinicalPicture {
  detectedFindings: string[];
  chronicity: "acute" | "recurrent" | "chronic" | "unknown";
  durationSummary?: string;
}

/** Stage 3: red-flag detection. */
export interface RedFlagFinding {
  label: string;
  severity: RedFlagSeverity;
  why: string;
  relevantDiagnoses: string[];
}

/** Stage 4+5+6: differential generation, evidence mapping, dangerous-diagnosis detection. */
export interface DifferentialItem {
  name: string;
  likelihood: Likelihood;
  dangerous: boolean;
  /** Required for dangerous items (build doc §18); optional otherwise. */
  why?: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  wouldIncreaseSuspicion: string[];
  wouldDecreaseSuspicion: string[];
}

/** Stage 7: contradiction detection. */
export interface ContradictionAssessment {
  hasContradiction: boolean;
  summary?: string;
  inconsistencies: string[];
}

/** Stage 8: missing-information analysis. */
export type MissingInformationItem = string;

/** Stage 9: investigation considerations, organized by purpose (build doc §20). */
export interface InvestigationSuggestion {
  purpose: string;
  items: string[];
}

/** Stage 10: follow-up reasoning. */
export interface FollowUpPlan {
  expected: string;
  dueInDays: number;
  ifImproving: string;
  ifNotImproving: string;
}

/** Optional second-model safety pass (strategy doc §13's "Model C: Safety checking"). */
export interface SafetyVerificationResult {
  concernsRaised: boolean;
  additionalDangerousConsiderations: string[];
  notes?: string;
}

export interface CaseAnalysisResult {
  normalized: NormalizedClinicalPicture;
  redFlags: RedFlagFinding[];
  differential: DifferentialItem[];
  contradiction: ContradictionAssessment;
  missingInformation: MissingInformationItem[];
  investigations: InvestigationSuggestion[];
  followUp: FollowUpPlan;
  safetyVerification?: SafetyVerificationResult;
}
