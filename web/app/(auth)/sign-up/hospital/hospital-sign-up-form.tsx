"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EMPTY_FACILITY, FacilityFields, validateFacility, type FacilityValue } from "@/components/auth/facility-fields";
import { Notice, PasswordField, PrimaryButton, SecondaryButton, TextField } from "@/components/auth/fields";
import { createBrowserClient } from "@/lib/database/client";

export function HospitalSignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [facility, setFacility] = useState<FacilityValue>(EMPTY_FACILITY);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function next(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateFacility(facility);
    if (problem) return setError(problem);
    setError(null);
    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    setLoading(true);
    const { data, error: err } = await createBrowserClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          intent: "hospital",
          hospital_name: facility.name.trim(),
          institution_type: facility.institutionType,
          care_scope: facility.careScope,
          care_scope_detail: facility.careScopeDetail.trim() || undefined,
          country: facility.country.trim() || undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (err) return setError(err.message);
    router.push(data.session ? "/onboarding" : "/check-email");
    router.refresh();
  }

  return (
    <div>
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-teal-deep">Step {step} of 2</p>
      <div className="mb-6 flex gap-1.5" aria-hidden="true">
        <span className="h-1 flex-1 rounded-full bg-teal-deep" />
        <span className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-teal-deep" : "bg-border"}`} />
      </div>

      {step === 1 ? (
        <form onSubmit={next} noValidate>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Tell us about your facility</h1>
          <p className="mb-8 mt-2 text-[16px] leading-relaxed text-slate">This is how your facility will appear on Diagnowise.</p>
          <FacilityFields value={facility} onChange={setFacility} />
          {error && (
            <div className="mt-5">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div className="mt-7">
            <PrimaryButton type="submit">Continue</PrimaryButton>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Create your administrator account</h1>
            <p className="mt-2 text-[16px] leading-relaxed text-slate">
              You&apos;ll manage the profile for <span className="font-semibold text-graphite">{facility.name.trim()}</span>.
            </p>
          </div>
          <TextField label="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" autoComplete="email" required />
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." autoComplete="new-password" required />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-3">
            <SecondaryButton type="button" onClick={() => { setError(null); setStep(1); }} aria-label="Back to facility details">
              <ArrowLeft size={16} />
            </SecondaryButton>
            <PrimaryButton type="submit" loading={loading} disabled={!name.trim() || !email.trim() || password.length < 1}>
              Create account
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
