"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, HeartHandshake } from "lucide-react";
import type { PatientExplanation, PatientGuidance } from "@diagnowise/core";
import { ExplanationSection } from "./explanation-section";
import { submitPatientReport } from "@/app/actions/patient";

const SEXES = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "other", label: "Other" },
  { key: "unspecified", label: "Prefer not to say" },
] as const;
const SEVERITIES = ["mild", "moderate", "severe"] as const;

const TONE: Record<string, string> = {
  emergency: "bg-critical-wash border-critical",
  urgent: "bg-danger-wash border-danger",
  soon: "bg-warning-wash border-warning",
  routine: "bg-teal-wash border-teal-accent",
};

export function GuidanceCard({ g }: { g: PatientGuidance }) {
  const tone = g.mode === "crisis" ? "bg-info-wash border-info" : (TONE[g.urgency] ?? TONE.routine);
  return (
    <div className={`rounded-2xl border p-5 mt-6 ${tone}`} role="status">
      <div className="flex items-start gap-3">
        {g.mode === "crisis" ? <HeartHandshake size={20} className="mt-0.5 shrink-0" /> : <AlertTriangle size={20} className="mt-0.5 shrink-0" />}
        <h2 className="font-display font-bold text-lg leading-snug">{g.headline}</h2>
      </div>
      <ul className="mt-4 space-y-2">
        {g.actions.map((a) => (
          <li key={a} className="text-sm text-graphite">
            &bull; {a}
          </li>
        ))}
      </ul>
      {g.featuresToMention.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-semibold mb-1.5 text-slate">Things worth telling your clinician</div>
          <ul className="space-y-1">
            {g.featuresToMention.map((f) => (
              <li key={f} className="text-sm text-graphite">&bull; {f}</li>
            ))}
          </ul>
        </div>
      )}
      {g.questionsForYourClinician.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-semibold mb-1.5 text-slate">Questions you may want to be ready for</div>
          <ul className="space-y-1">
            {g.questionsForYourClinician.map((q) => (
              <li key={q} className="text-sm text-graphite">&bull; {q}</li>
            ))}
          </ul>
        </div>
      )}
      {g.disclaimer && <p className="text-xs mt-5 text-slate">{g.disclaimer}</p>}
    </div>
  );
}

export function ReportForm() {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [onset, setOnset] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number] | "">("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<(typeof SEXES)[number]["key"] | "">("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<PatientGuidance | null>(null);
  const [explanation, setExplanation] = useState<PatientExplanation | null>(null);

  const valid = summary.trim().length > 0 && age.length > 0 && sex !== "" && ack;

  async function submit() {
    setBusy(true);
    setError(null);
    setGuidance(null);
    setExplanation(null);
    const res = await submitPatientReport({
      summary,
      onset: onset.trim() || undefined,
      severity: severity || undefined,
      age: Number(age),
      sex: sex as (typeof SEXES)[number]["key"],
      acknowledgedAiProcessing: ack,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuidance(res.guidance);
    setExplanation(res.explanation);
    router.refresh();
  }

  return (
    <div>
      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-2">What are you experiencing?</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="Describe your symptoms in your own words."
            className="w-full text-sm rounded-xl p-3 mt-1 border border-border resize-none focus:outline-none focus:ring-2 focus:ring-teal-accent"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-2">When did it start?</label>
            <input value={onset} onChange={(e) => setOnset(e.target.value)} placeholder="e.g. about 3 weeks ago" className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-2">Your age</label>
            <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 34" className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-2">How bad does it feel? (optional)</label>
          <div className="flex gap-2 mt-1">
            {SEVERITIES.map((s) => (
              <button key={s} type="button" onClick={() => setSeverity(s === severity ? "" : s)} className={`text-xs px-3 py-2 rounded-full border capitalize ${severity === s ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-2">Sex</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {SEXES.map((s) => (
              <button key={s.key} type="button" onClick={() => setSex(s.key)} className={`text-xs px-3 py-2 rounded-full border ${sex === s.key ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-slate">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
          <span>I understand that what I write is processed by an AI service to produce this guidance, and that it is not a diagnosis.</span>
        </label>
        <p className="text-xs text-slate-2">If this is an emergency, don&apos;t use this form. Call your local emergency number now.</p>
        <button onClick={submit} disabled={!valid || busy} className="w-full py-2.5 rounded-lg text-sm font-semibold bg-teal-deep text-white disabled:opacity-50">
          {busy ? "Working on it..." : "Get guidance"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      {guidance && <GuidanceCard g={guidance} />}
      {guidance && explanation && <ExplanationSection e={explanation} />}
    </div>
  );
}
