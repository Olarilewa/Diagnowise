/**
 * Diagnowise web — Supabase-backed AI interaction logger.
 *
 * Implements core/'s AiInteractionLogger interface (core/src/logger.ts)
 * against the ai_interactions table from the backend phase
 * (supabase/migrations/0001_init_schema.sql). This is the only file in the
 * app that connects the two — core/ itself has no database dependency (see
 * that package's docstrings for why).
 *
 * Writes through the CALLER'S own RLS-respecting session (see
 * lib/database/client.ts's createServerClient), not a service-role client —
 * the INSERT policy added in supabase/migrations/0004_ai_interactions_insert_policy.sql
 * means this only succeeds if the caller is genuinely the assigned
 * clinician on the case, which is exactly the authorization check we want:
 * one consistent security model, not a special case for AI-generated rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiInteractionLogEntry, AiInteractionLogger } from "@diagnowise/core";
import type { Database } from "@/types/database";

export class SupabaseAiInteractionLogger implements AiInteractionLogger {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async log(entry: AiInteractionLogEntry): Promise<void> {
    const { error } = await this.supabase.from("ai_interactions").insert({
      case_id: entry.caseId,
      model: entry.model,
      stage: entry.stage,
      input: entry.input as Record<string, unknown>,
      output: entry.output as Record<string, unknown>,
    });

    // Deliberately does not throw. Losing an audit-log write should not
    // fail the clinical action that produced it — the same reasoning
    // lib/security/auth.ts's recordAuditEvent already documents for
    // audit_logs. It's logged to the server console so it's not silent.
    if (error) {
      console.error("Failed to write ai_interactions row", { entry: { ...entry, input: "[omitted]", output: "[omitted]" }, error });
    }
  }
}
