# Patient layer (V2 Phase 2c)

## What exists
- `/sign-up/patient` — patient sign-up. **Closed by default**: it shows a "not open yet" notice
  until `PATIENT_SIGNUP_ENABLED=true` is set. Not linked from any marketing page.
- `/patient` — describe symptoms, get guidance, see earlier reports. Role-guarded: a non-patient
  is sent to `/dashboard`; a patient reaching `/dashboard` or `/onboarding` is sent to `/patient`.
- `web/lib/patient/submit-report.ts` — the logic (tested without a server);
  `web/app/actions/patient.ts` — thin Server Action wrapper.

## Sharing with a clinician (Phase 2d, migration 0007)
- A clinician generates a sharing code at `/patient-reports` (7-day expiry; a new code replaces the old;
  only a SHA-256 hash is stored, so it is shown once). The patient enters it at `/patient/sharing`.
- Clinicians read shared reports at `/patient-reports`; patients see who they share with and can stop
  at any time. Hospital admins and other clinicians see nothing.
- All of it runs through SECURITY DEFINER functions; the code tables have RLS enabled with no policies.
- Tests: `supabase/tests/03_consent_sharing.sql` (31 checks) and `web/test/consent.test.ts`.

## Rules the code enforces (all tested in `web/test/patient-report.test.ts`)
1. Emergency/crisis phrases are screened first, with no model. On a match the AI is **never called**
   and the patient's words are not sent to an external provider.
2. The reasoning pipeline's raw output never reaches the patient. The guidance object (fixed copy) names no
   diagnosis. Possible diagnoses reach the patient ONLY through the `patient_explanation` stage (see below),
   which is constrained and validated, and rejected as a whole if any rule fails.
3. If the AI fails, the patient still gets "see a clinician soon" guidance.
4. If saving fails, guidance is still shown.
5. The patient must tick an acknowledgement that an AI service processes their text.
6. The audit event stores the urgency tier only, never the patient's words.
7. **Patients cannot call `/api/clinical/*`** (stateless endpoints return named diagnoses). This was
   a real gap: they previously only required "signed in".

## AI explanation and possible diagnoses (product-owner decision, Phase 5b)
Patients see a plain-language explanation of what might be going on, THEN possible conditions, then a fixed
disclaimer: possible explanations, not a diagnosis, to help them understand, not complete, and to see a clinician
before any treatment. On screen the order is: urgency guidance first (safety), the explanation, the banner, the
conditions, the disclaimer.
- Only conditions from the pipeline's own differential can appear; the model cannot add one. A serious condition
  is always included when moderately/highly likely (the model cannot omit it), is marked "Can be serious", and
  never shows "what makes it less likely". Remote serious possibilities are not shown (the disclaimer says the list
  is incomplete; urgency is driven separately by red flags).
- The banner and disclaimer are fixed text set by code. The model cannot change them.
- Model text is rejected as a whole if it contains reassurance, ruling-out, treatment/doses/home remedies, statistics,
  or diagnostic certainty. One retry, then nothing from the model is shown and the patient gets the guidance alone.
- Emergency and crisis text never reaches it. `PATIENT_DIAGNOSES_ENABLED=false` switches it off without closing
  the rest of the patient area. The saved report records only the NAMES of the conditions shown.
- **Limit:** model-written text cannot be listed and reviewed in advance like the fixed copy, and a pattern denylist
  is a partial net. No real model output has been observed in testing (no live key was available). Before opening
  sign-up: have clinicians review a batch of real outputs across varied complaints, and have a lawyer review whether
  showing possible diagnoses makes this regulated medical-device software in the countries you launch in.

## Before launch (needs people, not code)
- [ ] A clinician reviews `docs/PATIENT_COPY_FOR_CLINICAL_REVIEW.md`, the phrase lists in
      `core/src/patient-safety/emergency-screen.ts`, AND a batch of real AI explanations (see above).
- [ ] Decide the privacy position on sending patient text to an AI provider (data processing terms
      with each provider you enable; the acknowledgement text in `report-form.tsx` must match it).
- [ ] In Supabase Auth settings, allow `<your-domain>/auth/callback` as a redirect URL
      (patient confirmation emails return there with `?next=/patient`).
- [ ] Apply migrations 0006 and 0007, and run the audit query from the 0006 notes.
- [ ] Have your reviewers accept the consent wording on `/patient/sharing` (scope: ALL reports, past and future).
- [ ] Set `PATIENT_SIGNUP_ENABLED=true`.

## Known limits
- The sign-up gate is UI-level. Anyone with your public Supabase anon key can still call
  `auth.signUp` with `account_type: "patient"`. That creates a patient account that can do nothing
  except read/write its own reports (RLS), but it is not a hard gate.
- Sharing is all-or-nothing: a code lets a clinician read ALL of the patient's reports (past and
  future) and display name until the patient stops sharing. No per-report sharing yet.
- A patient could be talked into entering a code that belongs to someone who isn't their clinician.
  The clinician's name is shown immediately and "Stop sharing" is one click, but there is no
  confirm-before-sharing step (it would need a preview function).
- Code guessing is slowed, not prevented: 40-bit codes, 7-day expiry, 10 failed attempts per patient
  per hour, email-confirmed sign-up. Patient accounts are cheap to create, so add per-IP rate
  limiting at the edge before launch.
- Patient AI analysis is not audit-logged (no case to attach it to).
- Age and sex are used for the analysis and not stored.
- English only.
