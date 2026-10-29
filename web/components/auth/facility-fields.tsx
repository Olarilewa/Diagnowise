"use client";

import { OptionCard, SelectField, TextField } from "./fields";
import type { CARE_SCOPES, INSTITUTION_TYPES } from "@/lib/signup/schemas";

export type FacilityValue = {
  name: string;
  institutionType: (typeof INSTITUTION_TYPES)[number];
  careScope: (typeof CARE_SCOPES)[number] | "";
  careScopeDetail: string;
  country: string;
};

export const EMPTY_FACILITY: FacilityValue = { name: "", institutionType: "hospital", careScope: "", careScopeDetail: "", country: "" };

/** Returns an error message, or null when the facility details are complete. */
export function validateFacility(v: FacilityValue): string | null {
  if (v.name.trim().length < 2) return "Enter the name of your hospital or clinic.";
  if (!v.careScope) return "Choose the kind of facility.";
  if (v.careScope !== "general" && !v.careScopeDetail.trim()) return v.careScope === "specialist" ? "Tell us which specialty." : "Tell us what kind of care you provide.";
  return null;
}

const SCOPES = [
  { key: "general", title: "General", description: "A broad range of services across specialties." },
  { key: "specialist", title: "Specialist", description: "Focused on one specialty, such as eye care, cancer or cardiology." },
  { key: "other", title: "Something else", description: "Diagnostics, maternity, mental health, a mobile or community service, and so on." },
] as const;

export function FacilityFields({ value, onChange }: { value: FacilityValue; onChange: (v: FacilityValue) => void }) {
  const set = (patch: Partial<FacilityValue>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <TextField label="Name of your hospital or clinic" value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Northbridge General Hospital" autoComplete="organization" required />
      <SelectField label="Type of institution" value={value.institutionType} onChange={(e) => set({ institutionType: e.target.value as FacilityValue["institutionType"] })}>
        <option value="hospital">Hospital</option>
        <option value="clinic">Clinic</option>
        <option value="academic">Teaching or academic centre</option>
        <option value="other">Other</option>
      </SelectField>
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-graphite" id="scope-label">
          What kind of care do you provide?
        </div>
        <div role="radiogroup" aria-labelledby="scope-label" className="space-y-2">
          {SCOPES.map((s) => (
            <OptionCard key={s.key} selected={value.careScope === s.key} title={s.title} description={s.description} onSelect={() => set({ careScope: s.key, careScopeDetail: s.key === "general" ? "" : value.careScopeDetail })} />
          ))}
        </div>
        {(value.careScope === "specialist" || value.careScope === "other") && (
          <div className="mt-3">
            <TextField
              label={value.careScope === "specialist" ? "Which specialty?" : "Describe your service"}
              value={value.careScopeDetail}
              onChange={(e) => set({ careScopeDetail: e.target.value })}
              placeholder={value.careScope === "specialist" ? "e.g. Ophthalmology, or Paediatric oncology" : "e.g. Maternity and newborn care"}
              maxLength={200}
            />
          </div>
        )}
      </div>
      <TextField label="Country" value={value.country} onChange={(e) => set({ country: e.target.value })} placeholder="e.g. Nigeria" autoComplete="country-name" />
    </div>
  );
}
