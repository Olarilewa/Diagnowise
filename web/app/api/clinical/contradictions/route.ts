import type { NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { handleContradictionsRequest } from "@/lib/clinical/handlers";
import { handleApiRoute } from "@/lib/utilities/route-helpers";

/**
 * POST /clinical/contradictions
 *
 * Stateless — see /clinical/differential's docstring for the design
 * rationale shared by every capability endpoint in this directory.
 * Unlike the others, `workingDiagnosis` is required here (validated by
 * contradictionsRequestSchema): there's nothing to check for a
 * contradiction against without one.
 *
 * Body: { patient: { age, sex }, presentingComplaint, history?, workingDiagnosis: string }
 */
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const supabase = getRouteHandlerSupabaseClient();
    const body = await request.json();
    return handleContradictionsRequest({ supabase }, body);
  });
}
