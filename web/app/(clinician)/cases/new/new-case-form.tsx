"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Loader2, Sparkles, X } from "lucide-react";
import { createCase, analyzeCase } from "@/app/actions/cases";

const SETTINGS = ["Outpatient — Internal Medicine", "Outpatient — Family Medicine", "Emergency Department", "Outpatient — Neurology", "Inpatient Ward", "Other"];

const ANALYSIS_STEPS = [
  "Reviewing clinical history",
  "Identifying key findings",
  "Checking for red flags",
  "Generating differential diagnoses",
  "Testing competing explanations",
  "Checking for diagnostic contradictions",
  "Preparing clinical considerations",
];

type Step = "patient" | "complaint" | "review";

export function NewCaseForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("patient");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [setting, setSetting] = useState("");
  const [complaint, setComplaint] = useState("");
  const [historyLabel, setHistoryLabel] = useState("");
  const [historyValue, setHistoryValue] = useState("");
  const [history, setHistory] = useState<{ label: string; value: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [analyzingStepIndex, setAnalyzingStepIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const patientValid = age.trim().length > 0 && sex && setting;

  function addHistoryItem() {
    if (!historyLabel.trim() || !historyValue.trim()) return;
    setHistory([...history, { label: historyLabel.trim(), value: historyValue.trim() }]);
    setHistoryLabel("");
    setHistoryValue("");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setAnalyzingStepIndex(0);

    const stepTimer = setInterval(() => {
      setAnalyzingStepIndex((i) => Math.min(i + 1, ANALYSIS_STEPS.length - 1));
    }, 480);

    const createResult = await createCase({
      age: Number(age),
      sex: sex as "male" | "female",
      setting,
      presentingComplaint: complaint,
      additionalHistory: history,
    });

    if (createResult.error || !createResult.caseId) {
      clearInterval(stepTimer);
      setSubmitting(false);
      setAnalyzingStepIndex(-1);
      setError(createResult.error ?? "Could not create the case.");
      return;
    }

    const analyzeResult = await analyzeCase(createResult.caseId);
    clearInterval(stepTimer);

    if (analyzeResult.error) {
      // The case was created even though analysis failed — send the
      // clinician to it so they can retry rather than losing the intake
      // they already entered.
      router.push(`/cases/${createResult.caseId}`);
      return;
    }

    router.push(`/cases/${createResult.caseId}`);
  }

  if (submitting) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-graphite/40">
        <div className="bg-white rounded-2xl p-7 w-[380px]">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={16} className="text-teal-deep" />
            <span className="text-sm font-semibold font-display">Analyzing case</span>
          </div>
          <div className="space-y-3">
            {ANALYSIS_STEPS.map((label, i) => {
              const done = i < analyzingStepIndex;
              const current = i === analyzingStepIndex;
              return (
                <div key={label} className={`flex items-center gap-3 text-sm ${done || current ? "text-graphite" : "text-slate-2"}`}>
                  {done ? (
                    <CheckCircle2 size={15} className="text-teal-accent" />
                  ) : current ? (
                    <Loader2 size={15} className="text-teal-accent animate-spin" />
                  ) : (
                    <Circle size={15} className="text-border" />
                  )}
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5 text-sm mb-5 text-slate">
        <ArrowLeft size={14} /> Back to dashboard
      </button>
      <h1 className="font-display font-bold text-xl mb-1">New clinical case</h1>
      <p className="text-sm mb-6 text-slate">Build the clinical picture before forming the diagnosis.</p>

      <div className="flex items-center gap-1.5 mb-8">
        {(["patient", "complaint", "review"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${["patient", "complaint", "review"].indexOf(step) >= i ? "bg-teal-deep" : "bg-border-soft"}`}
          />
        ))}
      </div>

      {step === "patient" && (
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="text-sm font-semibold mb-4">Patient</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-2">Age</label>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 48"
                  className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-2">Sex</label>
                <div className="flex gap-2 mt-1">
                  {(["male", "female"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSex(s)}
                      className={`flex-1 text-sm rounded-lg py-2 border capitalize ${sex === s ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-2">Clinical setting</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SETTINGS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSetting(s)}
                    className={`text-xs px-3 py-2 rounded-full border ${setting === s ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border text-graphite"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setStep("complaint")}
            disabled={!patientValid}
            className="w-full py-2.5 rounded-lg text-sm font-semibold mt-5 bg-teal-deep text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === "complaint" && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-1">What brought the patient in today?</div>
            <p className="text-xs mb-3 text-slate-2">Describe the presentation in natural language.</p>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={5}
              placeholder="Patient presents with..."
              className="w-full text-sm rounded-xl p-4 border border-border resize-none focus:outline-none focus:ring-2 focus:ring-teal-accent"
            />
          </div>

          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-1">Additional history (optional)</div>
            <p className="text-xs mb-3 text-slate-2">Anything else worth noting before analysis — prior treatment, family history, and so on.</p>
            {history.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {history.map((h, i) => (
                  <li key={i} className="text-xs flex items-center justify-between bg-porcelain rounded-lg px-3 py-2">
                    <span>
                      <span className="font-semibold">{h.label}:</span> {h.value}
                    </span>
                    <button onClick={() => setHistory(history.filter((_, idx) => idx !== i))}>
                      <X size={12} className="text-slate-2" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={historyLabel}
                onChange={(e) => setHistoryLabel(e.target.value)}
                placeholder="Label, e.g. Family history"
                className="flex-1 text-xs rounded-lg p-2 border border-border min-w-0"
              />
              <input
                value={historyValue}
                onChange={(e) => setHistoryValue(e.target.value)}
                placeholder="Detail"
                className="flex-1 text-xs rounded-lg p-2 border border-border min-w-0"
              />
              <button onClick={addHistoryItem} className="text-xs px-3 rounded-lg border border-border shrink-0">
                Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setStep("patient")} className="rounded-lg px-4 py-2.5 text-sm border border-border">
              Back
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!complaint.trim()}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold bg-teal-deep text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3">Review before analysis</div>
            <div className="text-xs space-y-2 text-graphite">
              <div>
                <span className="font-semibold">Patient:</span> {age}{sex[0]?.toUpperCase()} &middot; {setting}
              </div>
              <div>
                <span className="font-semibold">Presenting complaint:</span> {complaint}
              </div>
              {history.length > 0 && (
                <div>
                  <span className="font-semibold">Additional history:</span> {history.map((h) => `${h.label}: ${h.value}`).join("; ")}
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("complaint")} className="rounded-lg px-4 py-2.5 text-sm border border-border">
              Back
            </button>
            <button onClick={handleSubmit} className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold bg-teal-deep text-white flex items-center justify-center gap-2">
              <Sparkles size={14} /> Analyze Case
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
