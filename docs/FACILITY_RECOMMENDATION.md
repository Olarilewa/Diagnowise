# Facility recommendation (V2 Phase 3)

## What is built
`core/src/facilities/` — a pure, deterministic ranking function (`recommendFacilities`) with 21 tests,
including property tests over hundreds of random facility sets. No database, no network, no model.
**Not built yet:** the facility directory (tables, data import), the claim flow, the patient UI, and the
report-sharing/invitation flow described below.

## The rule about Diagnowise customers
We do **not** rank facilities higher because they use, or pay for, Diagnowise. Reasons:
- A patient choosing where to go for care is relying on us. If a worse or farther option can appear above a
  better one for commercial reasons, we are an advertiser, not a safety tool, and the first time that
  is discovered the product's credibility is gone.
- Undisclosed steering of patients toward affiliated providers can raise advertising, consumer-protection
  and (in some countries) health-referral issues. This is not legal advice: have a lawyer review it in
  each country you launch in.

What the code does instead, and what the tests enforce:
1. `Facility` has **no commercial field** (no plan, price, contract, customer flag). A type-level test fails
   to compile if one is added. The only Diagnowise field is `diagnowiseConnection`: a *capability*
   ("can receive a patient-shared report"), earned by verified onboarding, never by payment.
2. **Emergency and crisis: connection is invisible.** The result type cannot carry it. Output is the nearest
   emergency departments, by distance, nothing else (property-tested).
3. **Otherwise: quality first, distance second, connection last.** Connection can reorder only facilities that
   are *exactly equal* on sourced quality criteria and distance band (property-tested). When it does,
   the patient is told in words, per facility and in a note.
4. **Every quality claim needs a source**, or it earns nothing.
5. **Centers of excellence** (the "best in the world" list): routine/soon care and complex conditions only;
   cited designations; ordered by quality then name, never by distance or connection; always with the
   cost-and-travel caveat. No such list for urgent or emergency care.
6. **Thin data is shown as thin**, never as a confident list.

Patients still get what you wanted: a "Can receive my report" badge and filter, so a patient who values
sending their summary ahead can choose that themselves. That is patient-directed preference, not our thumb on the scale.

## How facilities come to Diagnowise through patients
```
patient gets guidance
   -> sees honest facility list (ranked on quality, with reasons)
   -> taps "Share my summary with this facility"
        connected facility ........ delivered securely; its clinicians read it in Patient reports
        not connected ............. patient gets a shareable summary of THEIR OWN words plus the
                                    patient-safe guidance, and a button: "Ask this clinic to join Diagnowise"
   -> the clinic receives an invitation with NO patient data in it
        ("a patient asked whether you can receive their summary digitally")
   -> the clinic claims its listing (verified), and can start receiving shared reports for free
   -> paid products sit above that: clinician workspace, hospital safety dashboard
```
- **Receiving shared reports is free for any verified facility.** That is what keeps `connected` from being
  purchasable, and it is the hook: the demand comes from the facility's own patients.
- **Claiming a listing** lets a facility correct its own details (hours, services, accreditation with
  evidence). It grants accuracy control, not rank.
- **Demand signal for your sales team:** aggregated counts ("patients asked to share with you in the last
  90 days"), shown only above a minimum threshold (e.g. 5) so no individual can be inferred.
- The invitation must never reveal who the patient is or why. Identity is shared only through the
  existing sharing-code flow, when the patient chooses.

## Data (the real work)
- Nearby facilities: open data (OpenStreetMap) plus national facility registries where they exist. Coverage
  and accuracy vary a lot by country; thin data must stay visible as thin.
- Centers of excellence: a small, hand-curated, **cited** list per specialty. Published rankings can be
  cited as a source but their lists cannot be copied wholesale.
- Location: coarsened to ~11 km (`coarsenLocation`) before it is stored or sent anywhere; not kept by default.

## Decisions for the product owner
- [ ] Confirm the rule above (customers do not get ranking priority). Changing it means changing tests
      that exist to stop exactly that, so it should be a deliberate, written decision.
- [ ] Confirm "receiving reports is free".
- [ ] Choose the first country and its directory source.
- [ ] Who verifies a facility's claim (registry number, official email domain, a call)?
