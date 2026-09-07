import type { NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { handleExplainRequest } from "@/lib/clinical/handlers";
import { handleApiRoute } from "@/lib/utilities/route-helpers";

/**
 * POST /clinical/explain
 *
 * Stateful, read-only. Returns the reasoning already recorded for a
 * specific case and pipeline stage (from ai_interactions) — this never
 * re-runs the model, it explains a decision that was already made. Build
 * doc §28 requires an audit trail; this is what makes that audit trail
 * queryable rather than something that only exists in a database table
 * nobody reads.
 *
 * Body: { caseId: string (uuid), stage: PipelineStage }
 */
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const supabase = getRouteHandlerSupabaseClient();
    const body = await request.json();
    return handleExplainRequest({ supabase }, body);
  });
}
