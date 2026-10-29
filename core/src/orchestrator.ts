/**
 * Diagnowise core — ReasoningOrchestrator.
 *
 * ClinicalReasoningEngine → ReasoningOrchestrator → Model Provider Interface
 * (strategy doc §12). This is the ReasoningOrchestrator: it decides which
 * provider handles which stage, retries once on a malformed model response
 * before giving up, and unconditionally logs and guardrail-checks every
 * stage's output — none of that is optional or something a caller can
 * forget to do.
 *
 * Every stage is exposed as its own public method (runNormalization,
 * runRedFlags, ...), each independently callable with just the inputs that
 * specific stage needs. `runFullAnalysis` is just one particular
 * composition of them, in order, skipping ones that don't apply — not a
 * separate code path. This is what lets phase 3's granular endpoints
 * (`/clinical/red-flags`, `/clinical/differential`, ...) run only the
 * stages a given request actually needs, without duplicating the
 * logging/retry/guardrail machinery those endpoints still require.
 */

import type { AiInteractionLogger } from "./logger.js";
import type { ModelProvider } from "./provider.js";
import type {
  CaseAnalysisResult,
  ClinicalContext,
  ContradictionAssessment,
  DifferentialItem,
  FollowUpPlan,
  InvestigationSuggestion,
  NormalizedClinicalPicture,
  PipelineStage,
  RedFlagFinding,
  SafetyVerificationResult,
} from "./types.js";
import { checkStructuredOutputForOvercertainty, type GuardrailViolation } from "./safety/guardrails.js";
import { StageOutputParseError } from "./json-utils.js";
import { runExtractionNormalization } from "./stages/extract-and-normalize.js";
import { runRedFlagDetection } from "./stages/red-flags.js";
import { runDifferentialGeneration } from "./stages/differential.js";
import { runContradictionDetection } from "./stages/contradictions.js";
import { runMissingInformationAnalysis } from "./stages/missing-information.js";
import { runInvestigationConsiderations } from "./stages/investigations.js";
import { runFollowUpReasoning } from "./stages/follow-up.js";
import { runSafetyVerification } from "./safety/safety-verification-stage.js";
import { runPatientExplanation } from "./stages/patient-explanation.js";
import type { PatientExplanation } from "./patient-safety/explanation.js";

/**
 * `default` handles every stage unless overridden. Strategy doc §13's
 * multi-model orchestration (different models for extraction vs.
 * differential vs. safety checking) is supported via `overrides` without
 * forcing every deployment to configure multiple providers just to run the
 * pipeline at all.
 */
export interface StageProviderMap {
  default: ModelProvider;
  overrides?: Partial<Record<PipelineStage, ModelProvider>>;
}

export interface RunFullAnalysisOptions {
  /** Off by default — see safety-verification-stage.ts's docstring. */
  runSafetyVerification?: boolean;
}

export interface StageRunResult<T> {
  output: T;
  violations: GuardrailViolation[];
}

export interface FullAnalysisOutcome {
  result: CaseAnalysisResult;
  /** Guardrail hits across every stage, keyed by stage. Always present, even if empty. */
  safetyWarnings: Partial<Record<PipelineStage, GuardrailViolation[]>>;
}

const MAX_ATTEMPTS_PER_STAGE = 2;

export class ReasoningOrchestrator {
  constructor(private readonly providers: StageProviderMap, private readonly logger: AiInteractionLogger) {}

  private providerFor(stage: PipelineStage): ModelProvider {
    return this.providers.overrides?.[stage] ?? this.providers.default;
  }

  /**
   * Runs one stage with retry-on-malformed-JSON, then unconditionally logs
   * and guardrail-checks the result regardless of whether the caller asked
   * for that — this is not something a call site can opt out of.
   */
  private async runStage<T>(
    stage: PipelineStage,
    caseId: string,
    fn: (provider: ModelProvider) => Promise<{ output: T; model: string; rawInput: unknown }>
  ): Promise<StageRunResult<T>> {
    const provider = this.providerFor(stage);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_STAGE; attempt++) {
      try {
        const { output, model, rawInput } = await fn(provider);
        const violations = checkStructuredOutputForOvercertainty(output);
        await this.logger.log({ caseId, stage, model, input: rawInput, output: { value: output, guardrailViolations: violations } });
        return { output, violations };
      } catch (error) {
        lastError = error;
        // Only malformed-JSON-shaped failures are worth retrying — a
        // provider/network error retrying immediately won't help and just
        // doubles the latency of a failure that's already going to surface.
        if (!(error instanceof StageOutputParseError) || attempt === MAX_ATTEMPTS_PER_STAGE) {
          break;
        }
      }
    }

    await this.logger.log({
      caseId,
      stage,
      model: provider.name,
      input: "unavailable — stage failed before producing output",
      output: { error: lastError instanceof Error ? lastError.message : String(lastError) },
    });
    throw lastError;
  }

  // ---------------------------------------------------------------------
  // Public, independently-callable stage methods.
  // ---------------------------------------------------------------------

  async runNormalization(context: ClinicalContext): Promise<StageRunResult<NormalizedClinicalPicture>> {
    return this.runStage("extraction_normalization", context.caseId, (p) => runExtractionNormalization(p, context));
  }

  async runRedFlags(context: ClinicalContext, normalized: NormalizedClinicalPicture): Promise<StageRunResult<RedFlagFinding[]>> {
    return this.runStage("red_flag_detection", context.caseId, (p) => runRedFlagDetection(p, context, normalized));
  }

  async runDifferential(
    context: ClinicalContext,
    normalized: NormalizedClinicalPicture,
    redFlags: RedFlagFinding[]
  ): Promise<StageRunResult<DifferentialItem[]>> {
    return this.runStage("differential_generation", context.caseId, (p) => runDifferentialGeneration(p, context, normalized, redFlags));
  }

  async runContradiction(
    context: ClinicalContext,
    normalized: NormalizedClinicalPicture,
    redFlags: RedFlagFinding[],
    differential: DifferentialItem[]
  ): Promise<StageRunResult<ContradictionAssessment>> {
    return this.runStage("contradiction_detection", context.caseId, (p) =>
      runContradictionDetection(p, context, normalized, redFlags, differential)
    );
  }

  async runMissingInformation(
    context: ClinicalContext,
    normalized: NormalizedClinicalPicture,
    differential: DifferentialItem[]
  ): Promise<StageRunResult<string[]>> {
    return this.runStage("missing_information_analysis", context.caseId, (p) =>
      runMissingInformationAnalysis(p, context, normalized, differential)
    );
  }

  async runInvestigations(context: ClinicalContext, differential: DifferentialItem[]): Promise<StageRunResult<InvestigationSuggestion[]>> {
    return this.runStage("investigation_considerations", context.caseId, (p) => runInvestigationConsiderations(p, context, differential));
  }

  async runFollowUp(
    context: ClinicalContext,
    differential: DifferentialItem[],
    redFlags: RedFlagFinding[]
  ): Promise<StageRunResult<FollowUpPlan>> {
    return this.runStage("follow_up_reasoning", context.caseId, (p) => runFollowUpReasoning(p, context, differential, redFlags));
  }

  async runSafetyCheck(context: ClinicalContext, differential: DifferentialItem[]): Promise<StageRunResult<SafetyVerificationResult>> {
    return this.runStage("safety_verification", context.caseId, (p) => runSafetyVerification(p, context, differential));
  }

  /**
   * Plain-language explanation and possible diagnoses for a PATIENT. Never part of
   * runFullAnalysis: it exists only for the patient flow. Fails closed (throws) after
   * two attempts that do not pass safety validation.
   */
  async runPatientExplanation(
    context: ClinicalContext,
    normalized: NormalizedClinicalPicture,
    redFlags: RedFlagFinding[],
    differential: DifferentialItem[]
  ): Promise<StageRunResult<PatientExplanation>> {
    return this.runStage("patient_explanation", context.caseId, (p) => runPatientExplanation(p, context, normalized, redFlags, differential));
  }

  /** Runs the full pipeline in order, skipping stages that don't apply. */
  async runFullAnalysis(context: ClinicalContext, options: RunFullAnalysisOptions = {}): Promise<FullAnalysisOutcome> {
    const safetyWarnings: Partial<Record<PipelineStage, GuardrailViolation[]>> = {};
    const record = (stage: PipelineStage, violations: GuardrailViolation[]) => {
      if (violations.length > 0) safetyWarnings[stage] = violations;
    };

    const normalizedRun = await this.runNormalization(context);
    record("extraction_normalization", normalizedRun.violations);

    const redFlagsRun = await this.runRedFlags(context, normalizedRun.output);
    record("red_flag_detection", redFlagsRun.violations);

    const differentialRun = await this.runDifferential(context, normalizedRun.output, redFlagsRun.output);
    record("differential_generation", differentialRun.violations);

    // Contradiction detection only makes sense against an existing working
    // diagnosis — skipped (not run-and-discarded) otherwise.
    let contradiction: CaseAnalysisResult["contradiction"] = { hasContradiction: false, inconsistencies: [] };
    if (context.workingDiagnosis) {
      const contradictionRun = await this.runContradiction(context, normalizedRun.output, redFlagsRun.output, differentialRun.output);
      record("contradiction_detection", contradictionRun.violations);
      contradiction = contradictionRun.output;
    }

    const missingInfoRun = await this.runMissingInformation(context, normalizedRun.output, differentialRun.output);
    record("missing_information_analysis", missingInfoRun.violations);

    const investigationsRun = await this.runInvestigations(context, differentialRun.output);
    record("investigation_considerations", investigationsRun.violations);

    const followUpRun = await this.runFollowUp(context, differentialRun.output, redFlagsRun.output);
    record("follow_up_reasoning", followUpRun.violations);

    let safetyVerification: CaseAnalysisResult["safetyVerification"];
    if (options.runSafetyVerification) {
      const safetyRun = await this.runSafetyCheck(context, differentialRun.output);
      record("safety_verification", safetyRun.violations);
      safetyVerification = safetyRun.output;
    }

    return {
      result: {
        normalized: normalizedRun.output,
        redFlags: redFlagsRun.output,
        differential: differentialRun.output,
        contradiction,
        missingInformation: missingInfoRun.output,
        investigations: investigationsRun.output,
        followUp: followUpRun.output,
        safetyVerification,
      },
      safetyWarnings,
    };
  }
}
