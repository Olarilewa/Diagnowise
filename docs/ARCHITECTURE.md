# Architecture

This document maps the two build prompts onto concrete decisions, and is
explicit about every place this phase deviated from, added to, or deferred
something from the literal spec — so nothing here is a silent guess.

## Scope covered so far

The build sequence agreed on was **backend → AI orchestration → API**, all
three done, followed by porting the existing frontend prototype into
`web/app/` to actually talk to that stack — also done, with clearly stated
gaps (below).

## Data model (build doc §30)

Implemented as `supabase/migrations/0001_init_schema.sql`, one table per
entity in the spec's list, with two additions:

- **`contradictions`** — the spec's entity list doesn't include a table for
  the Diagnostic Contradiction Engine (build doc §17), even though
  contradiction detection is called out as "one of the core differentiating
  features of Diagnowise." Storing it in `diagnoses` or `red_flags` would
  have meant overloading a table with a shape it doesn't fit. Given its own
  table instead.
- **`case_timeline_events`** — similarly, the Case History timeline
  (build doc §22) needs somewhere to live that isn't `audit_logs` (which is
  a compliance trail, not a patient/clinician-facing narrative — conflating
  the two would mean either exposing audit internals in the UI or filtering
  audit logs at read time to reconstruct a timeline, both worse than a
  dedicated table).

Everything else is a direct implementation of the spec's field list, with
the minimum extra columns needed for the system to actually function:
timestamps, status/risk enums as `check` constraints rather than free text,
and `cases.organization_id` denormalized from `patients.organization_id`
(kept in sync by trigger) purely so every RLS policy on every child table
doesn't have to join through `patients` to find out which org a case
belongs to — `cases` is the hottest table in the schema.

Evidence lists on `diagnoses` (`supporting_evidence`, `contradicting_evidence`)
and lists on `red_flags`/`contradictions` are `jsonb` rather than further
normalized child tables. Strategy doc §31 says explicitly not to
over-engineer the MVP; these are small, always read/written as a unit with
their parent row, and never queried independently — normalizing them would
add join complexity with no real benefit at this stage.

## Multi-tenancy & security (build doc §31; strategy doc §30)

Two redundant layers, deliberately:

1. **RLS is the ground truth** (`0003_rls_policies.sql`). Organization is
   the tenant boundary. A clinician sees cases assigned to them; a
   `hospital_admin` sees every case in their organization (required for the
   Hospital portal's org-wide safety queue to mean anything). Every child
   table inherits its parent case's visibility rather than having an
   independent access path. This was verified against a real two-hospital,
   three-user scenario in `supabase/tests/`, not just written and trusted —
   see that directory's README for how to re-run it.

2. **Application-level checks** (`web/lib/security/auth.ts`) exist on top
   of RLS, not instead of it. Their job is to fail with a clear 401/403
   *before* a query runs, rather than let RLS silently return zero rows —
   which from an API consumer's perspective is indistinguishable from "this
   resource doesn't exist" and makes for a confusing API once phase 3 adds
   HTTP endpoints on top of these functions.

`SECURITY DEFINER` helper functions (`current_user_org_id()`,
`current_user_role()`) exist specifically to avoid a subtle RLS trap:
policies on `public.users` that need to query `public.users` to determine
the caller's role would otherwise recurse into RLS evaluating RLS.

## What "AI-generated" means at the schema level (build doc §28, §45)

`diagnoses.is_ai_generated` and `symptoms.source` (`patient` / `clinician` /
`ai` / `system`) exist so that the trust-model requirement — every fact
distinguishable by where it came from — is enforced at the data layer, not
just styled that way in the UI. The frontend prototype already renders this
distinction (`SourceTag`, `AIBanner` components); this is what makes it true
rather than decorative once real data flows through it.

`ai_interactions` is the audit trail for the reasoning pipeline itself
(`stage` will hold values like `differential_generation`,
`red_flag_detection` once phase 2's 10-stage pipeline from build doc §27
exists) — kept separate from `audit_logs`, which is about *user* actions
(who viewed/edited what), not model calls.

## Deliberately not built yet

Per strategy doc §31 ("do not over-engineer the MVP"): no FHIR server, no
HL7 integration, no enterprise billing, no knowledge graph. `integrations/`,
`knowledge/`, `evaluation/` are READMEs describing what's planned and
pointing at the exact spec sections that describe them, not empty promises.

The **patient side** of auth/RLS is intentionally thin. `public.users` (and
therefore all of RLS) models clinicians, medical students, hospital admins,
and researchers — not patients. Strategy doc §29 says explicitly: "For V1,
build the architectural foundation and a carefully constrained patient
experience. Do not attempt a complete consumer healthcare platform yet."
The `patients` table exists (organization-scoped, minimal PII) as something
a clinician creates a case against; a patient-facing login/account system
with its own RLS model is real, separate work this phase didn't do.

## AI orchestration (build doc §27-28; strategy doc §12-13)

`core/` implements the pipeline as 7 independently-callable stages rather
than a literal 10, and combines differential generation with evidence
mapping and dangerous-diagnosis detection into one model call rather than
three. Both decisions trade a literal reading of build doc §27 for strategy
doc §13's explicit instruction not to call multiple models for every
request — see `core/README.md` for the full reasoning per stage.

**Multi-model orchestration is real, not aspirational.** `StageProviderMap`
lets different pipeline stages use different `ModelProvider` instances; the
optional `runSafetyVerification` pass implements strategy doc §13's "Model
C: Safety checking" concept as a second-opinion check on dangerous-diagnosis
coverage specifically, off by default. This isn't unused scaffolding —
`core/test/orchestrator.test.ts`'s main pipeline test exercises the
per-stage override path directly, not just the single-default-provider path.

**Two independent defenses against fabricated certainty**, not one:
1. Every stage's system prompt instructs hedged language and forbids
   diagnostic certainty claims (build doc §46's product language rules,
   embedded directly in `core/src/stages/*.ts`).
2. `core/src/safety/guardrails.ts` then deterministically re-checks every
   stage's actual output against a denylist of certainty phrasing,
   independent of whether the model followed instruction 1. A prompt is a
   request; this is the enforcement. Violations don't crash the pipeline —
   they're surfaced in the orchestrator's return value and logged
   permanently to `ai_interactions`, because build doc §28 says never
   conceal uncertainty, and silently swallowing a guardrail hit would be
   exactly that.

**A dangerous diagnosis without an explanation is treated as a bug, not a
valid result** — `stages/differential.ts` throws rather than returning it,
even though the field technically satisfies its Zod schema (`why` is
optional to allow non-dangerous items to omit it). Schema validity and
product-safety validity are different bars; the schema alone doesn't
enforce the second one.

**`ai_interactions` writes go through the requesting clinician's own
RLS-scoped session**, not a service-role bypass — `supabase/migrations/0004_ai_interactions_insert_policy.sql`
adds the INSERT policy this required (a gap found while building this
phase, not present when phase 1 shipped; see that migration's header for
why it's a new migration rather than an edit to 0003). One consistent
security model throughout, rather than a special case for AI-generated rows.

**`core/` still has zero database dependency.** `AiInteractionLogger` is an
interface `core/` defines and the caller implements — `web/lib/ai/logger.ts`
is the only file that knows `ai_interactions` exists as a table. This is
what makes `core/` genuinely extractable as an open-source package rather
than "open source" in name only with a Supabase import three files deep.

## The public API (build doc §11)

`web/app/api/clinical/*` implements all 7 endpoints from the spec's list,
split into two genuinely different designs rather than one shape stretched
seven ways:

**Stateful** (`/analyze`, `/explain`) are tied to an existing Diagnowise
case. `/analyze` loads the case's stored clinical picture, runs the full
pipeline, persists the result, and records an audit event — this is what
the frontend's New Case intake flow and "Re-run diagnostic analysis" button
call, in effect. `/explain` is read-only: it returns reasoning already
recorded in `ai_interactions`, never re-running the model — build doc §28's
audit trail requirement, made queryable rather than a database table
nobody reads.

**Stateless** (`/differential`, `/red-flags`, `/missing-information`,
`/contradictions`, `/follow-up`) accept a clinical picture directly in the
request body and don't require a case to exist at all. This is strategy
doc §11's stated goal — "other healthcare applications should eventually be
able to use Diagnowise's clinical reasoning capabilities without using the
Diagnowise interface" — implemented rather than left as an aspiration.
Internally each one composes whichever of `ReasoningOrchestrator`'s public
per-stage methods it needs (e.g. `/red-flags` runs only normalization +
red-flag detection; `/differential` adds differential generation on top) —
the orchestrator was refactored during this phase specifically to expose
those methods independently, rather than only offering one fixed
`runFullAnalysis()` entry point.

**The one real tradeoff, stated rather than hidden:** stateless calls use
`NullLogger` instead of the Supabase-backed one, because
`ai_interactions.case_id` is a required foreign key and there's no case to
attach a log row to. Guardrail checking still runs regardless (it's
independent of logging) and every violation is returned directly in the API
response — so a caller isn't losing safety information, just server-side
persistence of it for calls that were never tied to a case in the first
place. A true external-API audit trail would be a separate table not
foreign-keyed to `cases`; that's real, undone work, listed in
`integrations/README.md` rather than silently assumed away.

**Auth is one authenticated Diagnowise session for every endpoint in this
MVP cut**, including the stateless ones. The literal "without using the
Diagnowise interface" scenario — a third party with no Diagnowise account
calling the API directly — needs a separate API-key mechanism (issuance,
rotation, rate limiting) that doesn't exist yet. Also listed as a known gap
rather than assumed away.

**`persist-analysis.ts` was verified against a real PostgREST + Postgres
stack**, not just typechecked or tested against a mock — see
`supabase/tests/full-stack/README.md`. This is the strongest verification
in the whole codebase (it exercises real RLS through a real signed JWT with
the real client library) and it earned that effort: it caught a silent
error-swallowing bug in the persistence code and a missing RLS INSERT
policy on `case_timeline_events` — the exact same class of gap phase 2
found on `ai_interactions`, meaning "add an INSERT policy alongside every
new child table" is apparently a step this codebase's author (human or AI)
reliably forgets on the first pass. Both are fixed as new migrations
(`0004`, `0005`) rather than edits to already-shipped ones, same discipline
as phase 1.

**The orchestrator refactor is behavior-preserving, not just structurally
different.** `runFullAnalysis` used to inline all 7 stages' logic directly;
it now composes 8 public methods (`runNormalization`, `runRedFlags`, ...,
`runSafetyCheck`) that phase 3's endpoints also call independently. All 19
of phase 2's tests were re-run unchanged after the refactor and still pass,
which is what "behavior-preserving" means in practice, not just in theory.

## The frontend port

The prototype that existed before this phase was a single-file React
artifact with no real backend — navigation was `useState`, "cases" were a
hand-written JS object, and "Analyze Case" ran a canned animation before
revealing pre-written results. None of that was wrong for what it was (a
design and UX prototype, reviewed and iterated on extensively before any
backend existed to build against) — but it meant nothing in it actually
worked once phases 1–3 gave it something real to talk to.

**Real Next.js routing replaced the fake state-based router.** The
prototype's `topView`/`portal`/`view` state variables become actual URLs
(`/dashboard`, `/cases/[id]`, `/onboarding`, ...) using `<Link>` and
`useRouter()`. This is a genuine improvement, not just a technical
requirement of using Next.js — real URLs mean the browser back button
works, a case can be bookmarked or shared, and a page refresh doesn't lose
your place.

**Auth is real, not illustrative.** The prototype's sign-in/sign-up screens
updated local component state and nothing else. They now call
`supabase.auth.signInWithPassword` / `signUp` for real, there's a real
middleware refreshing the session cookie on every request
(`web/middleware.ts`), a real callback route for email confirmation
(`web/app/auth/callback/route.ts`), and the onboarding wizard's "Enter
Diagnowise" button actually inserts an `organizations` row and updates the
user's profile via a Server Action (`web/app/actions/auth.ts`) instead of
just navigating to a hardcoded next screen.

**The New Case flow calls the real reasoning pipeline.** The prototype
matched the presenting complaint against one of three hardcoded keyword
templates (gastric/respiratory/neuro) client-side, because there was no
real extraction/differential engine to call yet. Now that there is
(phases 2–3), that template-matching logic is gone — `createCase` (a
Server Action) writes a real patient and case row, and `analyzeCase` calls
`handleAnalyzeCase` from `web/lib/clinical/handlers.ts` **directly**, not
over HTTP to the app's own `/api/clinical/analyze` route. A Server Action
already runs server-side; routing through its own HTTP endpoint would add
latency for no benefit. The HTTP endpoint still exists, still does the
same thing, and is what an external caller or a future non-Next.js client
would use — this is one function called two different ways, not two
implementations to keep in sync.

**Verification: a real `next build`, not just `tsc --noEmit`.** Every
previous phase's TypeScript was verified by the compiler; this phase went
one step further and ran an actual Next.js production build, which
type-checks routes to their own stricter internal contracts than plain
`tsc` does and confirms which routes Next.js decided to statically
prerender versus render dynamically per-request. Every route requiring
`cookies()`-based auth (`/dashboard`, `/cases/*`, `/onboarding`) was
correctly inferred as dynamic; the marketing page and static auth screens
were correctly inferred as static — this is the build actually reasoning
about the code, not something asserted in a comment. The one wrinkle: this
sandbox's network allowlist doesn't include `fonts.googleapis.com`, which
`next/font/google` needs to reach at build time. The fix was **temporary
and verification-only** — swap to system fonts, run the build, confirm
success, restore the real Google Fonts implementation — not a change to
what's shipped. A real deployment environment (Vercel, or any host with
normal internet access) will not hit this at all.

## What the frontend port deliberately left out

Stated once here in full rather than scattered as inline comments:

- **Hospital and patient portals.** The prototype's versions of both were
  built entirely against hand-written mock data (Northbridge General
  Hospital's metrics, department stats, alert feeds) with no corresponding
  real backend queries — that aggregation logic doesn't exist in phases
  1–3 and building it is real, separate work, not a port. A
  `hospital_admin` who completes onboarding today lands on the clinician
  dashboard, which is incorrect for that role and stated as a known gap
  rather than quietly left to be discovered.
- **Developer and Pricing marketing pages.** No data dependency, so this is
  genuinely just unstarted work rather than a design problem — lowest
  priority because it's also the least risky to add later.
- **Confirming a working diagnosis from the differential list.** The
  persistence layer (phase 3) deliberately never writes
  `cases.working_diagnosis` — build doc §45's trust model means the AI
  proposes a differential and a clinician confirms one of them, and that
  confirmation action doesn't have a UI yet. The workspace shows "Not yet
  confirmed by clinician" honestly rather than guessing which differential
  item to promote.
- **Follow-up completion and investigation-ordering actions.** The
  workspace displays the follow-up plan and suggested investigations
  generated by the pipeline, but there's no button yet to mark a follow-up
  complete or an investigation ordered — display-only for now.
