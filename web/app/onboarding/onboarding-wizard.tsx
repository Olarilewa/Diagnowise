"use client";

import { useState } from "react";
import { ArrowRight, Building2, FlaskConical, Sparkles, Stethoscope, Users } from "lucide-react";
import { completeOnboarding } from "@/app/actions/auth";
import type { OnboardingInput } from "@/lib/signup/schemas";

const ROLES = [
  { key: "clinician", label: "Clinician", icon: Stethoscope },
  { key: "medical_student", label: "Medical Student", icon: Users },
  { key: "hospital_admin", label: "Hospital Administrator", icon: Building2 },
  { key: "researcher", label: "Researcher", icon: FlaskConical },
] as const;

const SPECIALTIES = ["Internal Medicine", "Family Medicine", "Emergency Medicine", "Pediatrics", "Neurology", "General Surgery", "Other"];
const ORG_TYPES = [
  { key: "hospital", label: "Hospital" },
  { key: "clinic", label: "Clinic" },
  { key: "academic", label: "Academic" },
  { key: "other", label: "Other" },
] as const;
const EXPERIENCE_LEVELS = ["Student / trainee", "Less than 2 years", "2–5 years", "5–15 years", "15+ years"];

type Role = (typeof ROLES)[number]["key"];

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | "">("");
  const [specialty, setSpecialty] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState<(typeof ORG_TYPES)[number]["key"]>("hospital");
  const [country, setCountry] = useState("");
  const [experience, setExperience] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOrganization = role === "clinician" || role === "medical_student" || role === "hospital_admin";
  const totalSteps = needsOrganization ? 5 : 4;
  const steps = needsOrganization ? ["role", "specialty", "organization", "experience"] : ["role", "specialty", "experience"];

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    const input: OnboardingInput = {
      role: role as Role,
      specialty,
      organizationName: needsOrganization ? organizationName : undefined,
      organizationType: needsOrganization ? organizationType : undefined,
      country: needsOrganization ? country : undefined,
    };
    const result = await completeOnboarding(input);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    // On success, completeOnboarding redirects server-side — nothing else to do here.
  }

  const canProceed: Record<number, boolean> = {
    1: true,
    2: !!role,
    3: !!specialty,
    4: needsOrganization ? organizationName.trim().length > 0 : !!experience,
    5: !!experience,
  };

  const currentKey = steps[step - 2] as string | undefined; // step 1 = welcome, no key needed

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-teal-deep" : "bg-border-soft"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center bg-teal-wash">
            <Stethoscope size={20} className="text-teal-deep" />
          </div>
          <h1 className="font-display font-bold text-xl mb-2">Welcome to Diagnowise, {defaultName.split(" ")[0]}</h1>
          <p className="text-sm text-slate">A few quick questions to set up your clinical workspace.</p>
        </div>
      )}

      {currentKey === "role" && (
        <div>
          <h1 className="font-display font-bold text-lg mb-4">What&apos;s your role?</h1>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRole(r.key)}
                className={`w-full flex items-center gap-3 rounded-xl p-3 text-left border ${
                  role === r.key ? "border-teal-deep bg-teal-wash" : "border-border bg-white"
                }`}
              >
                <r.icon size={16} className="text-teal-deep" />
                <span className="text-sm font-medium">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentKey === "specialty" && (
        <div>
          <h1 className="font-display font-bold text-lg mb-4">
            {role === "hospital_admin" ? "Which department do you oversee?" : role === "researcher" ? "What's your research focus?" : "What's your clinical specialty?"}
          </h1>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => (
              <button
                key={s}
                onClick={() => setSpecialty(s)}
                className={`text-xs px-3 py-2 rounded-full border ${
                  specialty === s ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border bg-white text-graphite"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentKey === "organization" && (
        <div>
          <h1 className="font-display font-bold text-lg mb-4">Where do you practice?</h1>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-2">Organization name</label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Northbridge General Hospital"
                className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-2">Type</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ORG_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setOrganizationType(t.key)}
                    className={`text-xs px-3 py-2 rounded-full border ${
                      organizationType === t.key ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border bg-white text-graphite"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-2">Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Nigeria"
                className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
              />
            </div>
          </div>
        </div>
      )}

      {currentKey === "experience" && (
        <div>
          <h1 className="font-display font-bold text-lg mb-4">How many years of experience?</h1>
          <div className="space-y-2">
            {EXPERIENCE_LEVELS.map((e) => (
              <button
                key={e}
                onClick={() => setExperience(e)}
                className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border ${
                  experience === e ? "border-teal-deep bg-teal-wash text-teal-deep" : "border-border bg-white text-graphite"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs mt-4 text-danger">{error}</p>}

      <div className="flex items-center gap-2 mt-8">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="rounded-lg px-4 py-2.5 text-sm border border-border">
            Back
          </button>
        )}
        {step < totalSteps ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed[step]}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold bg-teal-deep text-white disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={!canProceed[step] || submitting}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold bg-teal-deep text-white disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles size={14} /> {submitting ? "Setting up..." : "Enter Diagnowise"} {!submitting && <ArrowRight size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}
