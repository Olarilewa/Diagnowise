/**
 * Diagnowise web — consent sharing (patient <-> clinician).
 *
 * Thin, typed wrappers over the SECURITY DEFINER functions from migration 0007.
 * The database is the authority (RLS, hashing, rate limiting, expiry); this
 * layer adds role checks for clean 403s, input validation, and error mapping
 * that never leaks a database message to the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import { requirePatient, requireRole } from "@/lib/security/auth";
import { NotFoundError } from "@/lib/utilities/errors";
import { validateBody } from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;

/*
 * Row shapes returned by the SQL functions in migration 0007. They are declared
 * here and applied with explicit casts because supabase-js's rpc() generics do not
 * resolve the hand-written `Functions` entries for these signatures (data comes back
 * as `any`), and an implicit `any` would silently disable type checking on every field.
 * The shapes below must match supabase/migrations/0007_consent_sharing.sql.
 */
interface GrantRow { status: "ok" | "already_shared" | "invalid" | "rate_limited"; consent_id: string | null; clinician_name: string | null }
interface MyConsentRow { consent_id: string; clinician_name: string; granted_at: string; revoked_at: string | null }
interface ShareCodeRow { share_code: string; valid_until: string }
interface SharedReportRow { report_id: string; patient_name: string; summary: string; onset: string | null; severity: string | null; urgency: string | null; created_at: string }

export const shareCodeInputSchema = z.object({
  code: z.string().trim().min(6).max(24).regex(/^[A-Za-z0-9 -]+$/, "Sharing codes use letters, numbers, spaces and dashes only."),
});
const uuidSchema = z.object({ consentId: z.string().uuid() });

export type ShareResult =
  | { status: "ok" | "already_shared"; consentId: string; clinicianName: string }
  | { status: "invalid" | "rate_limited" };

export async function shareWithClinician(supabase: Client, rawInput: unknown): Promise<ShareResult> {
  await requirePatient(supabase);
  const { code } = validateBody(shareCodeInputSchema, rawInput);
  const { data, error } = await supabase.rpc("grant_consent_by_code", { code });
  if (error) {
    console.error("grant_consent_by_code failed", error.code);
    throw new Error("Could not process the sharing code.");
  }
  const row = (data as GrantRow[] | null)?.[0];
  if (!row) throw new Error("Could not process the sharing code.");
  if ((row.status === "ok" || row.status === "already_shared") && row.consent_id && row.clinician_name) {
    return { status: row.status, consentId: row.consent_id, clinicianName: row.clinician_name };
  }
  return { status: row.status === "rate_limited" ? "rate_limited" : "invalid" };
}

export interface MyConsent { consentId: string; clinicianName: string; grantedAt: string; revokedAt: string | null }

export async function listMyConsents(supabase: Client): Promise<MyConsent[]> {
  await requirePatient(supabase);
  const { data, error } = await supabase.rpc("my_consents");
  if (error) throw new Error("Could not load your sharing settings.");
  const rows = (data as MyConsentRow[] | null) ?? [];
  return rows.map((r) => ({ consentId: r.consent_id, clinicianName: r.clinician_name, grantedAt: r.granted_at, revokedAt: r.revoked_at }));
}

export async function revokeConsent(supabase: Client, rawInput: unknown): Promise<void> {
  await requirePatient(supabase);
  const { consentId } = validateBody(uuidSchema, rawInput);
  const { error } = await supabase.rpc("revoke_patient_consent", { consent_id: consentId });
  if (error) {
    if (error.code === "P0002") throw new NotFoundError("Sharing");
    console.error("revoke_patient_consent failed", error.code);
    throw new Error("Could not stop sharing.");
  }
}

const CARE_PROVIDER_ROLES = ["clinician", "medical_student"] as const;

export async function createShareCode(supabase: Client): Promise<{ code: string; validUntil: string }> {
  await requireRole(supabase, [...CARE_PROVIDER_ROLES]);
  const { data, error } = await supabase.rpc("create_share_code");
  const row = (data as ShareCodeRow[] | null)?.[0];
  if (error || !row) {
    console.error("create_share_code failed", error?.code);
    throw new Error("Could not create a sharing code.");
  }
  return { code: row.share_code, validUntil: row.valid_until };
}

export interface SharedReport { reportId: string; patientName: string; summary: string; onset: string | null; severity: string | null; urgency: string | null; createdAt: string }

export async function listSharedReports(supabase: Client): Promise<SharedReport[]> {
  await requireRole(supabase, [...CARE_PROVIDER_ROLES]);
  const { data, error } = await supabase.rpc("shared_reports");
  if (error) throw new Error("Could not load shared reports.");
  const rows = (data as SharedReportRow[] | null) ?? [];
  return rows.map((r) => ({ reportId: r.report_id, patientName: r.patient_name, summary: r.summary, onset: r.onset, severity: r.severity, urgency: r.urgency, createdAt: r.created_at }));
}
