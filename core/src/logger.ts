/**
 * Diagnowise core — logging interface.
 *
 * core/ has no database dependency (see types.ts's docstring on why). The
 * orchestrator calls this after every stage; web/lib/ai/ provides the real
 * implementation backed by the `ai_interactions` table from the backend
 * phase. Tests provide an in-memory implementation.
 *
 * This is what makes "log AI-generated recommendations" (build doc §28) and
 * "preserve an audit trail" true rather than aspirational — every stage
 * call is logged, unconditionally, by the orchestrator itself rather than
 * being something each stage has to remember to do.
 */

import type { PipelineStage } from "./types.js";

export interface AiInteractionLogEntry {
  caseId: string;
  stage: PipelineStage;
  model: string;
  input: unknown;
  output: unknown;
}

export interface AiInteractionLogger {
  log(entry: AiInteractionLogEntry): Promise<void>;
}

/** No-op logger for tests/scripts that don't care about the audit trail. */
export class NullLogger implements AiInteractionLogger {
  async log(): Promise<void> {
    /* intentionally empty */
  }
}

/** In-memory logger for tests that need to assert on what was logged. */
export class InMemoryLogger implements AiInteractionLogger {
  readonly entries: AiInteractionLogEntry[] = [];
  async log(entry: AiInteractionLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}
