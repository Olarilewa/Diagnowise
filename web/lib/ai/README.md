# lib/ai/ — AI orchestration glue (built, phase 2)

The Next.js-side connection between this app and `@diagnowise/core` (the
open-source reasoning engine, in `../../../core/`).

- **`logger.ts`** — `SupabaseAiInteractionLogger` implements core's
  `AiInteractionLogger` interface against the `ai_interactions` table.
  Writes through the caller's own RLS-respecting session, gated by the
  INSERT policy in `supabase/migrations/0004_ai_interactions_insert_policy.sql`
  — the same clinician-must-own-the-case rule as every other clinical table.

- **`orchestrator.ts`** — `createOrchestrator()` wires an `AnthropicProvider`
  (configured from `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`) together with the
  logger above into a ready `ReasoningOrchestrator`, for the stateful
  `/clinical/analyze` endpoint. `createStatelessOrchestrator()` (added in
  phase 3) builds the same provider with core's `NullLogger` instead, for
  the five capability endpoints that aren't tied to a case — see its
  docstring for why that's a deliberate tradeoff, not an oversight.
  `runCaseAnalysis()` remains available as a convenience wrapper for
  callers that want context-building + analysis in one call.
