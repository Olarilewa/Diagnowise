/**
 * Diagnowise core — public exports.
 */

export * from "./types.js";
export * from "./provider.js";
export * from "./logger.js";
export * from "./orchestrator.js";
export * from "./json-utils.js";
export { checkOvercertainLanguage, checkStructuredOutputForOvercertainty } from "./safety/guardrails.js";
export type { GuardrailViolation } from "./safety/guardrails.js";

export { AnthropicProvider } from "./providers/anthropic.js";
export type { AnthropicProviderConfig } from "./providers/anthropic.js";
export { MockProvider } from "./providers/mock.js";

export { runExtractionNormalization } from "./stages/extract-and-normalize.js";
export { runRedFlagDetection } from "./stages/red-flags.js";
export { runDifferentialGeneration } from "./stages/differential.js";
export { runContradictionDetection } from "./stages/contradictions.js";
export { runMissingInformationAnalysis } from "./stages/missing-information.js";
export { runInvestigationConsiderations } from "./stages/investigations.js";
export { runFollowUpReasoning } from "./stages/follow-up.js";
export { runSafetyVerification } from "./safety/safety-verification-stage.js";

// V2 Phase 1 — multi-provider AI
export { OpenAIProvider } from "./providers/openai.js";
export type { OpenAIProviderConfig } from "./providers/openai.js";
export { GoogleProvider } from "./providers/google.js";
export type { GoogleProviderConfig } from "./providers/google.js";
export { FailoverProvider, isFailoverEligible } from "./providers/failover.js";
export type { FailoverEvent, FailoverOptions } from "./providers/failover.js";
export { resolveProviderMap, ProviderConfigError } from "./provider-registry.js";
export type { ProviderKind, ProviderMap, ResolveOptions } from "./provider-registry.js";

// V2 Phase 2b — patient-safe guidance
export { screenPatientText } from "./patient-safety/emergency-screen.js";
export type { EmergencyCategory, EmergencyScreenResult } from "./patient-safety/emergency-screen.js";
export { buildPatientGuidance, sanitizePatientFacingText } from "./patient-safety/guidance.js";
export type { PatientGuidance, PatientGuidanceInput, Urgency } from "./patient-safety/guidance.js";

// V2 Phase 3a — facility recommendation
export { recommendFacilities, criteriaMet, DISTANCE_BANDS_KM } from "./facilities/recommend.js";
export { distanceKm, coarsenLocation } from "./facilities/geo.js";
export type {
  EmergencyOption,
  Facility,
  FacilityService,
  GeoPoint,
  RankedFacility,
  Recommendation,
  RecommendationInput,
  SourcedClaim,
} from "./facilities/types.js";

// V2 Phase 5b — patient explanation and possible diagnoses
export {
  PATIENT_EXPLANATION_BANNER,
  PATIENT_EXPLANATION_DISCLAIMER,
  MAX_PATIENT_CONDITIONS,
  selectConditionsForPatient,
  validatePatientExplanation,
  EXPLANATION_SYSTEM_PROMPT,
} from "./patient-safety/explanation.js";
export type { PatientExplanation, PatientCondition } from "./patient-safety/explanation.js";
