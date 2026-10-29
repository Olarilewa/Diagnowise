import { Building2 } from "lucide-react";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { requireRole } from "@/lib/security/auth";

const SCOPE_LABEL: Record<string, string> = { general: "General", specialist: "Specialist", other: "Other service" };
const TYPE_LABEL: Record<string, string> = { hospital: "Hospital", clinic: "Clinic", academic: "Teaching or academic centre", other: "Other" };

export default async function HospitalHomePage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await requireRole(supabase, ["hospital_admin"]);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", user.profile.organization_id ?? "").maybeSingle();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-teal-deep">Hospital</p>
      <h1 className="mt-2 font-display text-[32px] font-semibold tracking-tight">{org?.name ?? "Your facility"}</h1>

      <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-card">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-wash text-teal-deep">
            <Building2 size={22} strokeWidth={1.75} />
          </span>
          <dl className="grid flex-1 gap-x-8 gap-y-4 text-[15px] sm:grid-cols-2">
            <div><dt className="text-[13px] font-semibold text-slate-2">Type</dt><dd className="mt-0.5">{org ? TYPE_LABEL[org.type] ?? org.type : "—"}</dd></div>
            <div><dt className="text-[13px] font-semibold text-slate-2">Kind of care</dt><dd className="mt-0.5">{org?.care_scope ? `${SCOPE_LABEL[org.care_scope] ?? org.care_scope}${org.care_scope_detail ? `: ${org.care_scope_detail}` : ""}` : "Not set"}</dd></div>
            <div><dt className="text-[13px] font-semibold text-slate-2">Country</dt><dd className="mt-0.5">{org?.country ?? "Not set"}</dd></div>
            <div><dt className="text-[13px] font-semibold text-slate-2">Status</dt><dd className="mt-0.5">Unverified</dd></div>
          </dl>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-border bg-white/60 p-6">
        <h2 className="font-display text-[17px] font-semibold">Coming next</h2>
        <ul className="mt-3 space-y-1.5 text-[15px] text-slate">
          <li>Complete your facility profile, with a drafted bio you can edit</li>
          <li>Approve clinicians who ask to join your facility</li>
          <li>See diagnostic safety signals across your organization</li>
        </ul>
      </section>
    </main>
  );
}
