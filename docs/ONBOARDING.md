# Sign-up and onboarding (V2 Phase 5a)

## The flow
`/sign-up` is a chooser: **patient**, **clinician**, **hospital or clinic**. Each has its own short sign-up.
The details typed at sign-up are kept in the account's metadata, validated again after the email is confirmed
(`/onboarding`), and then applied. Metadata can never carry a role; the server picks the role from the path taken.

| Path | Collects | Result |
|---|---|---|
| Hospital (2 steps) | facility name, type of institution, **care scope** (general / specialist + which specialty / other + describe), country; then admin name, email, password | the person becomes `hospital_admin` of a new facility profile, and lands on `/hospital` |
| Clinician | name, email, password, the hospital or clinic they work at | a workplace profile is created; specialty is asked once after email confirmation |
| Patient | name, email, password | patient account (still closed behind `PATIENT_SIGNUP_ENABLED`; the chooser shows "Opening soon") |

## A v1 bug this fixes (migration 0009)
v1 onboarding ran `insert into organizations ... returning id`. Postgres also applies the SELECT policy to the
returned row, and a brand-new user is not a member yet, so the statement failed with "new row violates row-level
security policy". **No clinician or hospital could complete sign-up.** (Reproduced on the real migration chain.)
`create_organization()` now creates the organization, attaches the caller and sets their role in one step. Direct
organization inserts are closed (previously any user could create unlimited organizations).

## Design
Split screen: the brand side carries the product's real trust labels (AI-generated, Clinician-confirmed,
Patient-reported, System-derived) instead of a stock illustration. Inter and Manrope are bundled from npm, so no
request goes to Google when building or when someone opens a page. Rendered and checked at desktop and phone widths.

## Not built yet (deliberately)
- **Matching the clinician's hospital to one already on Diagnowise**, and the "on Diagnowise" sign beside it. Today every
  clinician sign-up creates a new workplace profile, so the same hospital can appear more than once.
- **Joining an existing hospital needs that hospital's admin to approve it.** Until that exists, clinicians cannot attach
  themselves to someone else's facility, which is the safe default.
- **AI-drafted hospital profiles** (looking the hospital up online, with sources, for the person to edit and approve).
- **Verification.** Every facility shows "Unverified". Self-edited profile details must not count as quality evidence
  in facility ranking until someone verifies them.
- Patient photos, the message-requests inbox, and the remaining hospital screens.
