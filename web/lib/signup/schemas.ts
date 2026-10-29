/**
 * Diagnowise web — sign-up and onboarding input shapes.
 *
 * Kept out of app/actions/*.ts because a "use server" file may only export
 * async functions, and these need to be shared with the client forms and tests.
 */

import { z } from "zod";

export const CARE_SCOPES = ["general", "specialist", "other"] as const;
export const INSTITUTION_TYPES = ["hospital", "clinic", "academic", "other"] as const;

const shortText = (max: number) => z.string().trim().min(1).max(max);

/** care_scope_detail is mandatory for "specialist" and "other" (mirrors the 0009 CHECK constraint). */
function scopeNeedsDetail(v: { careScope?: (typeof CARE_SCOPES)[number]; careScopeDetail?: string }): boolean {
  return v.careScope !== "specialist" && v.careScope !== "other" ? true : !!v.careScopeDetail?.trim();
}
const SCOPE_MESSAGE = "Tell us which specialty or kind of care.";

export const onboardingSchema = z
  .object({
    role: z.enum(["clinician", "medical_student", "hospital_admin", "researcher"]),
    specialty: shortText(120),
    organizationName: z.string().trim().min(2).max(200).optional(),
    organizationType: z.enum(INSTITUTION_TYPES).optional(),
    country: z.string().trim().max(120).optional(),
    careScope: z.enum(CARE_SCOPES).optional(),
    careScopeDetail: z.string().trim().max(200).optional(),
  })
  .refine(scopeNeedsDetail, { message: SCOPE_MESSAGE, path: ["careScopeDetail"] });
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * What a sign-up page stores in the user's auth metadata, to be read back after
 * the email is confirmed. Metadata is user-controlled, so it is validated like
 * any other input and can NEVER carry a role: the role is chosen by the server
 * from the intent (and the database refuses anything privileged).
 */
export const signupIntentSchema = z.union([
  z.object({ intent: z.literal("patient") }),
  z.object({ intent: z.literal("clinician"), workplace_name: z.string().trim().min(2).max(200) }),
  z
    .object({
      intent: z.literal("hospital"),
      hospital_name: z.string().trim().min(2).max(200),
      institution_type: z.enum(INSTITUTION_TYPES).default("hospital"),
      care_scope: z.enum(CARE_SCOPES),
      care_scope_detail: z.string().trim().max(200).optional(),
      country: z.string().trim().max(120).optional(),
    })
    .refine((v) => scopeNeedsDetail({ careScope: v.care_scope, careScopeDetail: v.care_scope_detail }), { message: SCOPE_MESSAGE, path: ["care_scope_detail"] }),
]);
export type SignupIntent = z.infer<typeof signupIntentSchema>;

/** Returns the validated intent, or null for anything missing, unknown or malformed. */
export function parseSignupIntent(metadata: unknown): SignupIntent | null {
  const parsed = signupIntentSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
