"use client";

import { useState } from "react";
import { completeOnboarding } from "@/app/actions/auth";
import { Notice, PrimaryButton, TextField } from "@/components/auth/fields";

const SPECIALTIES = ["Internal Medicine", "Family Medicine", "Emergency Medicine", "Paediatrics", "Neurology", "General Surgery", "Obstetrics & Gynaecology", "Psychiatry", "Cardiology", "Radiology"];

export function FinishClinician({ workplaceName }: { workplaceName: string }) {
  const [workplace, setWorkplace] = useState(workplaceName);
  const [specialty, setSpecialty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await completeOnboarding({ role: "clinician", specialty: specialty.trim(), organizationName: workplace.trim(), organizationType: "hospital" });
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-teal-deep">Almost there</p>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Finish setting up</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-slate">Two quick details and you&apos;re in.</p>
      </div>
      <TextField label="Your specialty" list="specialty-options" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Internal Medicine" autoComplete="off" required />
      <datalist id="specialty-options">
        {SPECIALTIES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <TextField label="Hospital or clinic where you work" value={workplace} onChange={(e) => setWorkplace(e.target.value)} required />
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton type="submit" loading={loading} disabled={!specialty.trim() || workplace.trim().length < 2}>
        Enter Diagnowise
      </PrimaryButton>
    </form>
  );
}
