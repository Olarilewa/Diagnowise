"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, FlaskConical, ShieldAlert, AlertTriangle, AlertOctagon, CalendarClock, History } from "lucide-react";
import { RiskBadge, StatusBadge, LikelihoodBadge, SourceTag, AIBanner } from "@/components/ui/badges";
import { Disclosure } from "@/components/ui/disclosure";
import { ReanalyzeButton } from "./reanalyze-button";
import type { Case, CaseTimelineEvent, Diagnosis, FollowUp, Investigation, Patient, RedFlag, Contradiction } from "@/types/database";

type CaseWithPatient = Case & { patients: Pick<Patient, "external_reference" | "age" | "sex"> | null };

interface Props {
  caseId: string;
  caseRow: CaseWithPatient;
  symptoms: { id: string; name: string; onset: string | null; duration: string | null; source: string }[];
  diagnoses: Diagnosis[];
  redFlags: RedFlag[];
  contradiction: Contradiction | null;
  investigations: Investigation[];
  followUp: FollowUp | null;
  timeline: CaseTimelineEvent[];
}

const TABS = [
  { key: "reasoning", label: "Diagnostic reasoning" },
  { key: "investigations", label: "Investigations" },
  { key: "followup", label: "Follow-up" },
  { key: "timeline", label: "Timeline" },
] as const;

export function WorkspaceView({ caseId, caseRow, symptoms, diagnoses, redFlags, contradiction, investigations, followUp, timeline }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("reasoning");

  const dangerous = diagnoses.filter((d) => d.category === "dangerous");
  const differential = diagnoses.filter((d) => d.category !== "dangerous");
  const investigationsByPurpose = investigations.reduce<Record<string, Investigation[]>>((acc, inv) => {
    const key = inv.purpose ?? "Additional considerations";
    (acc[key] ??= []).push(inv);
    return acc;
  }, {});

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm mb-5 text-slate w-fit">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="font-display font-bold text-xl">{caseRow.patients?.external_reference ?? caseId.slice(0, 8)}</h1>
            <StatusBadge status={caseRow.status} />
            <RiskBadge risk={caseRow.risk_level} />
          </div>
          <p className="text-sm text-slate">
            {caseRow.patients?.age ?? "?"}-year-old {caseRow.patients?.sex ?? "patient"} &middot; {caseRow.setting ?? "Setting not recorded"}
          </p>
        </div>
        <ReanalyzeButton caseId={caseId} />
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border-soft overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{ color: tab === t.key ? "var(--teal-deep)" : "var(--slate)", borderBottom: tab === t.key ? "2px solid var(--teal-deep)" : "2px solid transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reasoning" && (
        <div className="grid grid-cols-1 lg:flex lg:flex-row gap-5">
          {/* LEFT — patient case */}
          <div className="lg:w-72 shrink-0 space-y-3">
            <div className="bg-white border border-border rounded-2xl">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border-soft">
                <FileText size={16} className="text-teal-deep" />
                <h3 className="text-sm font-semibold font-display">Patient case</h3>
              </div>
              <div className="p-5 space-y-3">
                <Disclosure title="Presenting complaint" defaultOpen>
                  <p className="text-xs leading-relaxed text-graphite">{caseRow.presenting_complaint ?? "Not recorded."}</p>
                </Disclosure>
                <Disclosure title="History">
                  {symptoms.length === 0 ? (
                    <p className="text-xs text-slate-2">No additional history recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {symptoms.map((s) => (
                        <div key={s.id} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-graphite">{s.name}</span>
                            <SourceTag source={s.source} />
                          </div>
                          <div className="text-slate">{[s.onset, s.duration].filter(Boolean).join(", ") || "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Disclosure>
              </div>
            </div>
          </div>

          {/* CENTER — reasoning */}
          <div className="flex-1 space-y-4 min-w-0">
            <div className="bg-white border border-border rounded-2xl">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border-soft">
                <ShieldAlert size={16} className="text-teal-deep" />
                <h3 className="text-sm font-semibold font-display">Working diagnosis</h3>
              </div>
              <div className="p-5 flex items-center justify-between flex-wrap gap-2">
                <span className="text-lg font-semibold font-display">{caseRow.working_diagnosis ?? "Not yet confirmed by clinician"}</span>
                {diagnoses.length > 0 && <AIBanner />}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold font-display">Differential diagnosis</h3>
                <span className="text-xs text-slate-2">{diagnoses.length} possibilities considered</span>
              </div>
              {diagnoses.length === 0 ? (
                <div className="bg-white border border-border rounded-2xl p-6 text-center text-sm text-slate">
                  No analysis has been run yet. Click &quot;Re-run diagnostic analysis&quot; to generate a differential.
                </div>
              ) : (
                <div className="space-y-3">
                  {differential.map((d) => (
                    <DiagnosisCard key={d.id} d={d} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — safety panel */}
          <div className="lg:w-80 shrink-0 space-y-4">
            {dangerous.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold font-display mb-3 flex items-center gap-2">
                  <ShieldAlert size={15} className="text-critical" /> Diagnoses not to miss
                </h3>
                <div className="space-y-2.5">
                  {dangerous.map((d) => (
                    <DiagnosisCard key={d.id} d={d} dangerous />
                  ))}
                </div>
              </div>
            )}

            {redFlags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold font-display mb-3 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-warning" /> {redFlags.length} red flag{redFlags.length > 1 ? "s" : ""} identified
                </h3>
                <div className="space-y-2.5">
                  {redFlags.map((f) => (
                    <Disclosure key={f.id} tone="warning" title={f.finding}>
                      <p className="text-xs mb-2 leading-relaxed text-slate">{f.explanation}</p>
                      {f.relevant_diagnoses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {f.relevant_diagnoses.map((r) => (
                            <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-warning-wash text-warning">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </Disclosure>
                  ))}
                </div>
              </div>
            )}

            {contradiction && (
              <div className="bg-white border-l-[3px] rounded-xl p-4" style={{ borderLeftColor: "var(--teal-accent)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertOctagon size={15} className="text-teal-deep" />
                  <span className="text-sm font-semibold">Diagnostic reconsideration</span>
                </div>
                <p className="text-xs mb-3 leading-relaxed text-slate">{contradiction.summary}</p>
                {contradiction.inconsistencies.length > 0 && (
                  <>
                    <div className="text-xs font-semibold mb-1.5 text-slate-2">Potential inconsistencies</div>
                    <ul className="space-y-1">
                      {contradiction.inconsistencies.map((i) => (
                        <li key={i} className="text-xs text-graphite">
                          &bull; {i}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {diagnoses.length === 0 && (
              <p className="text-xs text-slate-2 bg-white border border-border rounded-xl p-4">
                Red flags and dangerous-diagnosis flags will appear here once analysis has run.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "investigations" && (
        <div className="max-w-2xl space-y-4">
          <div className="text-xs font-semibold px-3 py-2 rounded-lg inline-block bg-teal-wash text-teal-deep">
            Considerations for clinician review — not autonomous orders
          </div>
          {Object.keys(investigationsByPurpose).length === 0 ? (
            <p className="text-sm text-slate">No investigations suggested yet.</p>
          ) : (
            Object.entries(investigationsByPurpose).map(([purpose, items]) => (
              <div key={purpose} className="bg-white border border-border rounded-2xl">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-border-soft">
                  <FlaskConical size={16} className="text-teal-deep" />
                  <h3 className="text-sm font-semibold font-display">{purpose}</h3>
                </div>
                <ul className="p-5 space-y-2">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 text-sm text-graphite">
                      <FlaskConical size={14} className="text-teal-accent" /> {it.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "followup" && (
        <div className="max-w-2xl">
          {!followUp ? (
            <p className="text-sm text-slate">No follow-up plan has been generated yet.</p>
          ) : (
            <div className="bg-white border border-border rounded-2xl">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border-soft">
                <CalendarClock size={16} className="text-teal-deep" />
                <h3 className="text-sm font-semibold font-display">Diagnostic follow-up</h3>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <div className="text-xs font-semibold mb-1 text-slate-2">Expected response</div>
                  <p className="text-sm text-graphite">{followUp.expected_response}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1 text-slate-2">Review due</div>
                  <p className="text-sm text-graphite">{followUp.due_date ? new Date(followUp.due_date).toLocaleDateString() : "Not set"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className="max-w-2xl">
          <div className="bg-white border border-border rounded-2xl">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border-soft">
              <History size={16} className="text-teal-deep" />
              <h3 className="text-sm font-semibold font-display">Case history</h3>
            </div>
            <div className="p-5">
              {timeline.length === 0 ? (
                <p className="text-sm text-slate">No events recorded yet.</p>
              ) : (
                timeline.map((t, i) => (
                  <div key={t.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 bg-teal-deep" />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-6">
                      <div className="text-xs font-semibold text-slate-2">{new Date(t.occurred_at).toLocaleString()}</div>
                      <div className="text-sm font-semibold text-graphite">{t.event}</div>
                      {t.detail && <div className="text-xs mt-0.5 text-slate">{t.detail}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DiagnosisCard({ d, dangerous }: { d: Diagnosis; dangerous?: boolean }) {
  return (
    <Disclosure
      tone={dangerous ? "critical" : "default"}
      title={
        <span className="flex items-center gap-2 flex-wrap">
          {d.diagnosis}
          {dangerous && <AlertOctagon size={13} className="text-critical" />}
        </span>
      }
      rightSlot={d.likelihood ? <LikelihoodBadge level={d.likelihood} /> : undefined}
    >
      {d.reasoning && <p className="text-xs mb-3 leading-relaxed text-slate">{d.reasoning}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold mb-1.5 text-success">Supporting evidence</div>
          <ul className="space-y-1">
            {d.supporting_evidence.map((s) => (
              <li key={s} className="text-xs text-graphite">
                &bull; {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold mb-1.5 text-danger">Contradicting evidence</div>
          <ul className="space-y-1">
            {d.contradicting_evidence.map((s) => (
              <li key={s} className="text-xs text-graphite">
                &bull; {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Disclosure>
  );
}
