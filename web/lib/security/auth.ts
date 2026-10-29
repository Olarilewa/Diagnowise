/**
 * Diagnowise — authentication & authorization
 *
 * Two layers of enforcement, deliberately redundant (spec §31: "explicit
 * authorization" as a first-class concern, not an afterthought):
 *
 *   1. RLS policies (supabase/migrations/0003_rls_policies.sql) are the
 *      ground truth. Even if every check in this file were deleted, a user
 *      could not read or write another organization's data — the database
 *      itself won't return it.
 *
 *   2. This file adds application-level checks that (a) fail fast with a
 *      clear error before a query is even attempted, and (b) let route
 *      handlers express intent clearly ("this endpoint requires a hospital
 *      admin") rather than relying on RLS silently returning zero rows,
 *      which is indistinguishable from "this resource doesn't exist" and
 *      makes for a bad API.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserProfile, UserRole } from "@/types/database";
import { ForbiddenError, UnauthenticatedError } from "@/lib/utilities/errors";

type Client = SupabaseClient<Database>;

/** The authenticated user's auth identity plus their Diagnowise profile row. */
export interface AuthedUser {
  id: string;
  email: string;
  profile: UserProfile;
}

/**
 * Resolves the current session (if any) into a full AuthedUser. Returns
 * null rather than throwing — callers decide whether anonymous access is
 * acceptable for their endpoint (requireAuth() below is the throwing variant).
 */
export async function getCurrentUser(supabase: Client): Promise<AuthedUser | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).single();

  // A missing profile row (should be impossible after the signup trigger,
  // but defend against it — e.g. a service-role-created auth user) is
  // treated as "not fully authenticated" rather than crashing the request.
  if (profileError || !profile) return null;

  return { id: user.id, email: user.email ?? profile.email, profile };
}

/** Throws UnauthenticatedError if there's no valid session. */
export async function requireAuth(supabase: Client): Promise<AuthedUser> {
  const user = await getCurrentUser(supabase);
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** Throws ForbiddenError if the authenticated user doesn't have one of the allowed roles. */
export async function requireRole(supabase: Client, allowedRoles: UserRole[]): Promise<AuthedUser> {
  const user = await requireAuth(supabase);
  if (!allowedRoles.includes(user.profile.role)) {
    throw new ForbiddenError(`This action requires one of the following roles: ${allowedRoles.join(", ")}.`);
  }
  return user;
}

/**
 * Roles allowed to use the clinician-facing reasoning endpoints (/api/clinical/*).
 * Patients are deliberately excluded: those endpoints return raw differentials
 * with named diagnoses, which patients must only ever see through the
 * patient-safe guidance layer (core/src/patient-safety).
 */
export const CLINICAL_ROLES: UserRole[] = ["clinician", "medical_student", "hospital_admin", "researcher"];

export async function requireClinicalRole(supabase: Client): Promise<AuthedUser> {
  return requireRole(supabase, CLINICAL_ROLES);
}

export async function requirePatient(supabase: Client): Promise<AuthedUser> {
  return requireRole(supabase, ["patient"]);
}

/**
 * Confirms the current user can act on a specific case, per the same rule
 * RLS enforces (assigned clinician, or hospital_admin in that org) — used
 * by route handlers that need to give a real 403 rather than let a query
 * silently return zero rows.
 */
export async function requireCaseAccess(supabase: Client, caseId: string): Promise<AuthedUser> {
  const user = await requireAuth(supabase);
  const { data: caseRow, error } = await supabase.from("cases").select("id, clinician_id, organization_id").eq("id", caseId).maybeSingle();

  if (error || !caseRow) {
    // RLS already hid it if it's out of scope — from the caller's
    // perspective a forbidden case and a nonexistent one look the same,
    // which is the correct behavior (don't leak existence of other orgs' data).
    throw new ForbiddenError("This case is not accessible.");
  }

  const isAssignedClinician = caseRow.clinician_id === user.id;
  const isOrgAdmin = user.profile.role === "hospital_admin" && caseRow.organization_id === user.profile.organization_id;

  if (!isAssignedClinician && !isOrgAdmin) {
    throw new ForbiddenError("This case is not accessible.");
  }

  return user;
}

/**
 * Writes an audit_logs row. Fire-and-forget-safe: failures are logged but
 * never thrown, because an audit-log write failing should not fail the
 * underlying clinical action (spec §31 wants audit logs, not a system that
 * refuses to save a diagnosis because logging hiccuped).
 */
export async function recordAuditEvent(
  supabase: Client,
  params: { userId: string; action: string; entity: string; entityId?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: params.userId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.error("Failed to write audit log", { params, error });
  }
}
