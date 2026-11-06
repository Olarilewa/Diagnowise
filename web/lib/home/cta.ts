/**
 * Where the homepage's calls to action should go for the person looking at it. These are the real,
 * working routes; nothing here is a placeholder.
 */

/** "Try a case": creating a case needs an account, so visitors go to clinician sign-up. */
export function tryCaseHref(role: string | null): string {
  switch (role) {
    case "clinician":
    case "medical_student":
      return "/cases/new";
    case "hospital_admin":
      return "/hospital";
    case "patient":
      return "/patient";
    case "researcher":
      return "/dashboard";
    default:
      return "/sign-up/clinician";
  }
}

/** The patient call to action, or null while patient accounts are closed (no fake link is shown). */
export function patientHref(role: string | null, signupOpen: boolean): string | null {
  if (role === "patient") return "/patient";
  return signupOpen ? "/sign-up/patient" : null;
}
