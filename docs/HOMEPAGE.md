# Homepage repositioning

Base: `main` at `53f0663` ("chore: diagnowise V2"). One commit on top. The reasoning engine, backend, database,
authentication, case creation and dashboard were not modified.

## What changed
- `web/app/page.tsx` is rebuilt as ten sections in the brief's order: hero, the 1-in-20 statistic, why Diagnowise exists,
  how it works, patients, clinicians, hospitals, open source, developers and researchers, final call to action.
- New components in `web/components/home/`; header and footer rewritten (`web/components/site-header.tsx`, `site-footer.tsx`).
- GitHub is persistent in the header (icon-only on small screens). Mobile gets a no-JavaScript menu.
- Fixed strings and destinations live in `web/lib/home/` and are pinned by `web/test/home.test.ts`.
- The existing reasoning-loop diagram (`flow-diagram.tsx`) and the "Never 'AI says cancer.' Always why." idea are kept.

## Decisions you should know about
- **The statistic's attribution differs from the brief.** The brief says "Source: AHRQ. Singh et al." The paper is by Singh,
  Meyer and Thomas (Houston VA / Baylor) in BMJ Quality & Safety 2014;23:727-731, and finds errors affect at least 1 in 20 US
  adults. AHRQ partly funded it and issued a release about it, but AHRQ is not the author. The page cites the paper and says AHRQ
  partly funded it. It is labelled a U.S. outpatient estimate, and only one statistic is shown.
- **The link to the paper** is the journal's own address (`qualitysafety.bmj.com/content/23/9/727`). The address in the brief could
  not be checked (the journal blocks automated requests); this one was confirmed to exist through search.
- **"Try a case"** needs an account, so it goes to the real route for each visitor: clinician sign-up for a visitor, `/cases/new`
  for a signed-in clinician, `/hospital` for a hospital admin, `/patient` for a patient.
- **"Understand your health"** appears only when patient accounts are open (`PATIENT_SIGNUP_ENABLED=true`). While closed, the page
  says "Patient accounts are opening soon" instead of showing a link that goes nowhere.
- **Hospital section:** the six capabilities (unresolved cases ... referral delays) are labelled as direction of development, not
  running in any hospital. A "Where this stands today" panel separates Available now (facility registration, clinician case
  workspace) from In development (safety signals and an overview; no hospital dashboard yet). Integrations and analytics are
  labelled "Direction, not shipped." Self-hosting carries the brief's note about separate infrastructure and AI-provider costs.
- **Accessibility fix beyond the homepage:** an automated audit found the shared small grey (`--slate-2`) at 3.45:1 contrast
  (needs 4.5:1). It is now `#64706c` (4.56:1 or better on every background it is used on), which also improves small text
  elsewhere in the app.
- Removed `web/app/(auth)/sign-up/sign-up-form.tsx`: dead code from before the sign-up redesign that was left behind when the
  files were copied into the repo.
- The brand mark (two interlocking rings) from the sign-up redesign is now used in the header and footer too.

## Verified
- typecheck clean; 112 core + 53 web tests (6 new: exact headline and supporting sentence, exact links, call-to-action routing for
  each role, no dead patient link, a guard against unsupported claims such as validation, accuracy figures, partners, user numbers,
  and exactly one labelled statistic).
- Real browser (Chromium): headline exact; "Try a case" and "View on GitHub" fully above the fold at 1440x900, 1280x720 and
  390x844; no horizontal scroll on mobile; every in-page anchor resolves; external links open in a new tab with `noopener`;
  first Tab lands on "Skip to content"; one `h1`.
- Automated accessibility audit (axe-core, WCAG 2 A/AA, 2.1 AA and best practice): no violations at desktop or mobile width.
  This found, and I fixed, the grey contrast above and a sideways-scrolling diagram that keyboard users could not focus.
- The GitHub repository, licence and docs links return 200.

## Not verified
- The paper link and DOI could not be fetched from the build environment.
- Chromium only: no Safari or Firefox, no real phones, no screen-reader session, no performance audit.
- The page was checked against a placeholder backend; signed-in variants are covered by unit tests, not by logging in.

## Roadmap (not done, and not claimed on the page)
Hospital dashboard and verification; matching clinicians to hospitals already on Diagnowise; AI-drafted facility profiles; message
requests; patient photo upload; condition-level facility ranking; EHR integration; institutional analytics. Patient accounts open
after clinical review (see `docs/PATIENT_LAYER.md`).

## Brief's checklist
| Item | Status |
|---|---|
| Original headline exact | Yes (pinned by test) |
| Hero sentence covers patients, clinicians, hospitals | Yes (pinned by test) |
| Both hero buttons above the fold | Yes, three screen sizes |
| "Try a case" opens the real workflow | Yes, role-aware |
| "View on GitHub" opens the repository | Yes |
| One statistic, accurate source | Yes; attribution corrected as above |
| Patient value and safety boundaries | Yes |
| Clinician value; reasoning loop preserved | Yes |
| Hospital opportunity without overclaiming | Yes; labelled direction vs today |
| Apache 2.0 and self-hosting stated accurately | Yes, with the cost note |
| Developers have their own pathway | Yes |
| Mobile responsive; existing functionality intact | Yes; all tests pass |
