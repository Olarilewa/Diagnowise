import type { NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { handleDifferentialRequest } from "@/lib/clinical/handlers";
import { handleApiRoute } from "@/lib/utilities/route-helpers";

/**
 * POST /clinical/differential
 *
 * Stateless. Runs extraction/normalization, red-flag detection, and
 * differential generation against a clinical picture supplied directly in
 * the request — no Diagnowise case required. This is strategy doc §11's
 * "other healthcare applications should be able to use Diagnowise's
 * clinical reasoning without using the Diagnowise interface," made real.
 *
 * Requires a standard authenticated Diagnowise session for this MVP cut —
 * a separate API-key mechanism for genuinely external, non-Diagnowise-user
 * callers is documented as future work in docs/ARCHITECTURE.md, not
 * silently assumed away.
 *
 * Body: { patient: { age, sex }, presentingComplaint, history?, workingDiagnosis? }
 */
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const supabase = getRouteHandlerSupabaseClient();
    const body = await request.json();
    return handleDifferentialRequest({ supabase }, body);
  });
}
