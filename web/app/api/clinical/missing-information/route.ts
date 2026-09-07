import type { NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { handleMissingInformationRequest } from "@/lib/clinical/handlers";
import { handleApiRoute } from "@/lib/utilities/route-helpers";

/**
 * POST /clinical/missing-information
 *
 * Stateless — see /clinical/differential's docstring for the design
 * rationale shared by every capability endpoint in this directory.
 *
 * Body: { patient: { age, sex }, presentingComplaint, history?, workingDiagnosis? }
 */
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const supabase = getRouteHandlerSupabaseClient();
    const body = await request.json();
    return handleMissingInformationRequest({ supabase }, body);
  });
}
