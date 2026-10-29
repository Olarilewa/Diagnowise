import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireAuth } from "@/lib/security/auth";
import { listSharedReports } from "@/lib/patient/consent";
import { ShareCodeCard } from "./share-code-card";

const URGENCY_LABEL: Record<string, string> = {
  emergency: "Emergency care advised",
  urgent: "Be seen within a day",
  soon: "See a clinician in the next few days",
  routine: "Mention at next appointment",
};

export default async function PatientReportsPage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await requireAuth(supabase);
  if (user.profile.role !== "clinician" && user.profile.role !== "medical_student") redirect("/dashboard");
  const reports = await listSharedReports(supabase);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display font-bold text-2xl">Patient reports</h1>
      <p className="text-sm mt-1 mb-8 text-slate">Reports patients have chosen to share with you. These are patient-reported and unverified.</p>
      <ShareCodeCard />
      <h2 className="text-sm font-semibold font-display mt-10 mb-3">Shared with you</h2>
      {reports.length === 0 ? (
        <p className="text-sm text-slate-2">Nothing shared yet. Generate a code above and give it to your patient.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.reportId} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{r.patientName}</span>
                <span className="text-xs text-slate-2">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-graphite">{r.summary}</p>
              <div className="text-xs text-slate mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {r.onset && <span>Onset: {r.onset}</span>}
                {r.severity && <span className="capitalize">Reported severity: {r.severity}</span>}
                {r.urgency && <span className="font-semibold text-teal-deep">Guidance given to patient: {URGENCY_LABEL[r.urgency] ?? r.urgency}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
