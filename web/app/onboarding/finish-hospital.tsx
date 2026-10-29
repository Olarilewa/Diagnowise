"use client";

import { useState } from "react";
import { completeOnboarding } from "@/app/actions/auth";
import { FacilityFields, validateFacility, type FacilityValue } from "@/components/auth/facility-fields";
import { Notice, PrimaryButton } from "@/components/auth/fields";

export function FinishHospital({ initial }: { initial: FacilityValue }) {
  const [facility, setFacility] = useState<FacilityValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateFacility(facility);
    if (problem) return setError(problem);
    setError(null);
    setLoading(true);
    const result = await completeOnboarding({
      role: "hospital_admin",
      specialty: "Administration",
      organizationName: facility.name.trim(),
      organizationType: facility.institutionType,
      country: facility.country.trim() || undefined,
      careScope: facility.careScope || undefined,
      careScopeDetail: facility.careScopeDetail.trim() || undefined,
    });
    // On success the server action redirects; we only get here on failure.
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-teal-deep">Almost there</p>
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Confirm your facility</h1>
      <p className="mb-8 mt-2 text-[16px] leading-relaxed text-slate">Check these details from sign-up. You can change them later.</p>
      <FacilityFields value={facility} onChange={setFacility} />
      {error && (
        <div className="mt-5">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-7">
        <PrimaryButton type="submit" loading={loading}>
          Create facility profile
        </PrimaryButton>
      </div>
    </form>
  );
}
