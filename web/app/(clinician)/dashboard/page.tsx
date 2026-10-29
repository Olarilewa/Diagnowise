import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardList, FileText, Plus } from "lucide-react";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireAuth } from "@/lib/security/auth";
import { RiskBadge, StatusBadge } from "@/components/ui/badges";

interface CaseRow {
  id: string;
  status: string;
  risk_level: string;
  working_diagnosis: string | null;
  presenting_complaint: string | null;
  updated_at: string;
  patients: { external_reference: string; age: number | null; sex: string | null } | null;
}

export default async function DashboardPage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await requireAuth(supabase);
  if (user.profile.role === "hospital_admin") redirect("/hospital");

  // RLS already scopes this correctly: a clinician sees their own cases, a
  // hospital_admin sees every case in their organization — no extra
  // .eq(clinician_id, ...) needed or wanted here (see
  // supabase/migrations/0003_rls_policies.sql).
  const { data: cases } = await supabase
    .from("cases")
    .select("id, status, risk_level, working_diagnosis, presenting_complaint, updated_at, patients(external_reference, age, sex)")
    .order("updated_at", { ascending: false })
    .returns<CaseRow[]>();

  const allCases = cases ?? [];
  const needsAttention = allCases.filter((c) => c.status === "reassessment_required" || c.risk_level === "high" || c.risk_level === "critical");

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl">Good morning, {user.profile.name}</h1>
        <p className="text-sm mt-1 text-slate">Your diagnostic workspace</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-sm font-semibold font-display mb-3 text-graphite">Active cases</h2>
            {allCases.length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-slate mb-4">No active cases yet.</p>
                <Link href="/cases/new" className="text-sm font-semibold text-teal-deep">
                  Start a Case →
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {allCases.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="bg-white border border-border rounded-2xl p-5 text-left hover:shadow-sm transition-shadow block"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-2">{c.patients?.external_reference ?? "—"}</span>
                      <RiskBadge risk={c.risk_level} />
                    </div>
                    <div className="text-sm font-semibold mb-1">
                      {c.patients?.age ?? "?"}
                      {c.patients?.sex ? c.patients.sex.charAt(0).toUpperCase() : ""}
                    </div>
                    <div className="text-sm mb-3 text-teal-deep">{c.working_diagnosis ?? "Working diagnosis pending"}</div>
                    <div className="flex items-center justify-between">
                      <StatusBadge status={c.status} />
                      <span className="text-[11px] text-slate-2">{new Date(c.updated_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold font-display mb-3">Quick actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link href="/cases/new" className="bg-white border border-border rounded-xl p-4 flex flex-col items-start gap-3 hover:border-teal-accent">
                <Plus size={17} className="text-teal-deep" />
                <span className="text-sm font-medium">New Case</span>
              </Link>
              <div className="bg-white border border-border rounded-xl p-4 flex flex-col items-start gap-3 opacity-60">
                <CalendarClock size={17} className="text-teal-deep" />
                <span className="text-sm font-medium">Follow-ups</span>
                <span className="text-[10px] text-slate-2">Coming soon</span>
              </div>
              <div className="bg-white border border-border rounded-xl p-4 flex flex-col items-start gap-3 opacity-60">
                <FileText size={17} className="text-teal-deep" />
                <span className="text-sm font-medium">Clinical Knowledge</span>
                <span className="text-[10px] text-slate-2">Coming soon</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold font-display mb-3">Diagnostic alerts</h2>
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold text-danger">{needsAttention.length} cases require attention</div>
            {needsAttention.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`} className="w-full text-left flex items-start gap-3 py-2 border-t border-border-soft block">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                <div>
                  <div className="text-xs font-semibold">{c.patients?.external_reference ?? "—"}</div>
                  <div className="text-xs text-slate">{c.status === "reassessment_required" ? "Reassessment required" : "High risk"}</div>
                </div>
              </Link>
            ))}
            {needsAttention.length === 0 && <p className="text-xs text-slate-2">Nothing needs attention right now.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
