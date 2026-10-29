import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requirePatient } from "@/lib/security/auth";
import { ReportForm } from "./report-form";

const URGENCY_LABEL: Record<string, string> = {
  emergency: "Emergency care advised",
  urgent: "Be seen within a day",
  soon: "See a clinician in the next few days",
  routine: "Mention at your next appointment",
};

export default async function PatientHomePage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await requirePatient(supabase);
  const { data: reports } = await supabase
    .from("patient_reports")
    .select("id, summary, details, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display font-bold text-2xl">Hello, {user.profile.name.split(" ")[0]}</h1>
      <p className="text-sm mt-1 mb-8 text-slate">
        Describe what you&apos;re experiencing and we&apos;ll help you understand when to seek care. This is not a diagnosis, and it never replaces a clinician.
      </p>

      <ReportForm />

      <h2 className="text-sm font-semibold font-display mt-12 mb-3">Your earlier reports</h2>
      {(reports ?? []).length === 0 ? (
        <p className="text-sm text-slate-2">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {(reports ?? []).map((r) => {
            const urgency = typeof r.details?.urgency === "string" ? r.details.urgency : null;
            return (
              <li key={r.id} className="bg-white border border-border rounded-xl p-4">
                <div className="text-xs text-slate-2 mb-1">{new Date(r.created_at).toLocaleDateString()}</div>
                <div className="text-sm text-graphite">{r.summary.length > 140 ? `${r.summary.slice(0, 140)}…` : r.summary}</div>
                {urgency && <div className="text-xs mt-2 font-semibold text-teal-deep">{URGENCY_LABEL[urgency] ?? ""}</div>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-2 mt-10">
        Sharing a report with your clinician is coming next. Until then, you can show them this page or read your description to them.
      </p>
    </main>
  );
}
