import type { NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { handleAnalyzeCase } from "@/lib/clinical/handlers";
import { handleApiRoute } from "@/lib/utilities/route-helpers";

/**
 * POST /clinical/analyze
 *
 * Stateful. Runs the full reasoning pipeline against an existing case's
 * stored clinical picture, persists the result (diagnoses, red flags,
 * contradiction if any, investigations, follow-up), and records an audit
 * event. Requires the caller to be the case's assigned clinician or a
 * hospital_admin in that organization (enforced twice: RLS, and
 * requireCaseAccess inside the handler for a clean 403 instead of a silent
 * empty result).
 *
 * Body: { caseId: string (uuid), runSafetyVerification?: boolean }
 */
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const supabase = getRouteHandlerSupabaseClient();
    const body = await request.json();
    return handleAnalyzeCase({ supabase }, body);
  });
}
