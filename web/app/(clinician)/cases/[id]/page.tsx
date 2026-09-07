import { notFound } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireCaseAccess } from "@/lib/security/auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/utilities/errors";
import { WorkspaceView } from "./workspace-view";

export default async function CaseWorkspacePage({ params }: { params: { id: string } }) {
  const supabase = getRouteHandlerSupabaseClient();

  try {
    await requireCaseAccess(supabase, params.id);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthenticatedError) notFound();
    throw err;
  }

  const [caseResult, symptomsResult, diagnosesResult, redFlagsResult, contradictionsResult, investigationsResult, followUpsResult, timelineResult] =
    await Promise.all([
      supabase.from("cases").select("*, patients(external_reference, age, sex)").eq("id", params.id).single(),
      supabase.from("symptoms").select("*").eq("case_id", params.id).order("created_at"),
      supabase.from("diagnoses").select("*").eq("case_id", params.id).order("created_at"),
      supabase.from("red_flags").select("*").eq("case_id", params.id).order("created_at"),
      supabase.from("contradictions").select("*").eq("case_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("investigations").select("*").eq("case_id", params.id).order("created_at"),
      supabase.from("follow_ups").select("*").eq("case_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("case_timeline_events").select("*").eq("case_id", params.id).order("occurred_at"),
    ]);

  if (!caseResult.data) notFound();

  return (
    <WorkspaceView
      caseId={params.id}
      caseRow={caseResult.data}
      symptoms={symptomsResult.data ?? []}
      diagnoses={diagnosesResult.data ?? []}
      redFlags={redFlagsResult.data ?? []}
      contradiction={contradictionsResult.data}
      investigations={investigationsResult.data ?? []}
      followUp={followUpsResult.data}
      timeline={timelineResult.data ?? []}
    />
  );
}
