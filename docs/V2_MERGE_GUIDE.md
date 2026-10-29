# Diagnowise V2 Merge Guide

This document explains how Diagnowise 2.0 merges into the existing v1
codebase (confirmed live at github.com/Olarilewa/Diagnowise). It follows
the mandatory structure from the v2 master prompt. It is a plan, not a
changelog — nothing described here has been implemented yet. Per the
prompt's own instruction ("do NOT begin implementation immediately"),
implementation starts only after this guide is reviewed.

**Scoping stance, stated once up front:** every section below proposes a
milestone-1 slice, not the full long-term vision from the master prompt.
Section 25 of that prompt says not to overbuild and to prioritize
architecture that *allows* expansion over building everything now. Where a
feature is deferred, that's a deliberate choice, named as such — not an
oversight discovered later.

## A. Current architecture

npm workspace: `core/` (`@diagnowise/core`, zero DB dependency) + `web/`
(Next.js App Router, Supabase via `@supabase/ssr`). Five migrations define
organizations/users/patients/cases and their clinical child tables, with
RLS enforcing organization isolation and `hospital_admin` org-wide
visibility. The AI layer has a real `ModelProvider` interface
(`core/src/provider.ts`) and `ReasoningOrchestrator`
(`core/src/orchestrator.ts`) that already accepts a `StageProviderMap`
with per-stage provider overrides — but only one implementation
(`AnthropicProvider`) exists. Seven `/clinical/*` API endpoints exist,
split stateful (tied to a case, audited) and stateless (accept a clinical
picture directly). The frontend has a real clinician portal; hospital and
patient portals remain unported prototype mockups with no backend queries.

## B. Target architecture (milestone 1)

1. Multi-provider AI: a provider registry reading env config, feeding the
   *existing* `StageProviderMap` — no orchestrator changes.
2. Patient layer: a new account type (`patient_accounts`), a consent model
   (`patient_consents`), and a conservative, non-diagnostic-language UI
   reusing the existing stateless capability endpoints.
3. Hospital layer: real aggregation queries and a review workflow
   (`diagnostic_reviews`) on top of RLS access control that already exists.
4. Knowledge graph: a minimal schema (`knowledge_entities`,
   `knowledge_relationships`, `evidence_sources`) with provenance fields
   from day one, seeded with a small number of manually-curated, cited
   entities — not auto-generated at scale.
5. Evaluation: `evaluation_cases` / `evaluation_runs` tables and a script
   (not yet a UI) that runs synthetic cases through every configured
   provider for comparison.
6. API keys: schema only this milestone; enforcement middleware is
   milestone 2.

Explicitly deferred past milestone 1: the public Atlas beyond one working
page type, global search, the full contributor workflow (issue templates,
open-questions/bottlenecks/ideas sections), and any FHIR/HL7 code beyond
an isolated adapter interface.

## C. Files to modify

- `core/src/index.ts` — export the new provider registry.
- `web/lib/ai/orchestrator.ts` — `createOrchestrator()` /
  `createStatelessOrchestrator()` build their `StageProviderMap` from the
  registry instead of hardcoding `AnthropicProvider`.
- `web/.env.example` — add `AI_PROVIDER_DEFAULT`, per-stage override vars,
  and placeholders for additional provider API keys.
- `supabase/migrations/` — additive only (see section F). No existing
  migration is edited, per this project's own established discipline of
  treating shipped migrations as immutable.
- `web/app/(clinician)/layout.tsx` — no change to clinician behavior;
  referenced here only because the new `(hospital)` and `(patient)` route
  groups sit alongside it and must not alter its auth check.
- `README.md`, `docs/ARCHITECTURE.md` — updated to describe the new layers
  once built, not before.

## D. Files to create

- `core/src/providers/openai.ts`, `core/src/providers/google.ts` — new
  `ModelProvider` implementations, same interface as `anthropic.ts`.
- `core/src/provider-registry.ts` — resolves env config into a
  `StageProviderMap`.
- `core/src/providers/failover.ts` — a decorator `ModelProvider` that
  tries a primary then falls back, itself implementing `ModelProvider` so
  the orchestrator needs no awareness of it.
- `supabase/migrations/0006_patient_layer.sql` — `patient_accounts`,
  `patient_consents`, plus RLS.
- `supabase/migrations/0007_hospital_review.sql` — `organization_members`,
  `diagnostic_reviews`, plus RLS.
- `supabase/migrations/0008_knowledge_graph.sql` — `knowledge_entities`,
  `knowledge_relationships`, `evidence_sources`; publicly readable, writes
  restricted to a contributor/reviewer role.
- `supabase/migrations/0009_evaluation.sql` — `ai_providers`, `ai_models`,
  `evaluation_cases`, `evaluation_runs`.
- `supabase/migrations/0010_api_keys.sql` — `api_keys` (schema only this
  milestone).
- `web/app/(patient)/...` — patient routes (dashboard, symptom intake,
  clinician-prep summary).
- `web/app/(hospital)/...` — hospital routes (dashboard, cases,
  departments, reports), replacing the prototype's mock-data versions.
- `web/app/atlas/[type]/[slug]/page.tsx` — one Atlas page type for
  milestone 1 (e.g. conditions), reading `knowledge_entities`.
- `core/src/patient-safety/rephrase.ts` — transforms clinician-facing
  reasoning output into hedged, non-diagnostic patient-facing language
  before display; never lets a raw differential-with-named-diagnoses
  reach a patient screen unmediated.
- `evaluation/run-comparison.ts` — the provider-comparison script.
- `docs/AI_PROVIDER_ARCHITECTURE.md`, `docs/KNOWLEDGE_ARCHITECTURE.md`,
  `docs/DATA_GOVERNANCE.md` — one per new subsystem, written once that
  subsystem exists, not speculatively now.

## E. Files to preserve

Everything in `web/lib/clinical/`, `web/lib/security/auth.ts`,
`web/lib/database/`, all five existing migrations, `core/src/stages/*`,
`core/src/orchestrator.ts`'s public method shape, and the entire clinician
portal (`web/app/(clinician)/**`). None of this is rewritten. The
orchestrator's constructor signature (`StageProviderMap`, `AiInteractionLogger`)
does not change — the registry produces the same shape it already accepts.

## F. Database migrations

New tables only; no column drops, no type changes on existing tables.

- **`patient_accounts`** (`id`, `patient_id` → `patients.id`, `user_id`
  → `auth.users.id`, `created_at`). RLS: a user can only read their own
  row via this join. This is what makes a patient a first-class
  authenticated identity for the first time — today's `patients` table
  is purely a clinician-created record with no login of its own.
- **`patient_consents`** (`id`, `patient_id`, `case_id`, `granted_at`,
  `revoked_at`). A clinician's case involving a patient is not visible to
  that patient's own account unless a consent row exists — prevents a
  patient's login from silently becoming a backdoor into clinician-authored
  case data.
- **`organization_members`** (`id`, `organization_id`, `user_id`,
  `department`, `role_in_org`). Additive alongside `users.organization_id`
  (kept for backward compatibility as "primary org") — enables
  department-level hospital views without a breaking change.
- **`diagnostic_reviews`** (`id`, `case_id`, `flagged_by`, `reason`,
  `status` [`open`/`reviewed`/`dismissed`], `reviewed_by`, `reviewed_at`).
  Backs "this case contains a pattern that may warrant review" — deliberately
  models a flag for human attention, not a verdict.
- **`knowledge_entities`** (`id`, `type`, `slug`, `name`, `summary`,
  `status` [`draft`/`proposed`/`reviewed`/`verified`/`deprecated`],
  `evidence_level`, `version`, `created_by`, `reviewed_by`, `jurisdiction`,
  `last_verified_at`). RLS: SELECT open to all (this is the public
  knowledge layer); INSERT/UPDATE restricted to a `contributor` capability
  checked via a new `knowledge_contributors` join table, since knowledge
  contribution is not organization-scoped the way clinical data is.
- **`knowledge_relationships`** (`id`, `from_entity_id`, `to_entity_id`,
  `relationship_type`, `notes`). Same RLS shape as above.
- **`evidence_sources`** (`id`, `knowledge_entity_id`, `citation`, `url`,
  `publication_date`, `evidence_level`). Same RLS shape. No row in this
  table is ever machine-generated without a real, checkable citation —
  enforced by review process, not by a database constraint alone.
- **`ai_providers`** (`id`, `name`, `status`) and **`ai_models`** (`id`,
  `provider_id`, `model_name`, `role_hint`, `is_active`) — reference data
  for the provider registry and for attributing evaluation runs.
- **`evaluation_cases`** (`id`, `name`, `clinical_context` jsonb,
  `expected_differential` jsonb, `expected_red_flags` jsonb, `is_public`)
  and **`evaluation_runs`** (`id`, `evaluation_case_id`, `provider_id`,
  `model_id`, `output` jsonb, `score` jsonb, `scored_at`). Synthetic data
  only, same discipline as `supabase/seed.sql` — never real patient cases.
- **`api_keys`** (`id`, `organization_id`, `key_hash`, `name`, `scopes`,
  `rate_limit_per_minute`, `created_by`, `revoked_at`). Schema now;
  enforcement (checking a bearer token against this table in
  `web/lib/security/auth.ts`) is milestone 2.

Migration order: `0006` (patients) and `0007` (hospital) have no
dependency on each other and can ship in either order or in parallel.
`0008` (knowledge) is independent of both. `0009` (evaluation) should
follow the provider-registry code (section G) since `ai_providers` rows
are seeded from the same provider list the registry reads. `0010` (API
keys) has no dependency and can ship any time.

Rollback: every new migration is additive (new tables, no altered
columns), so rollback is `DROP TABLE IF EXISTS` in reverse order with no
data-loss risk to existing tables. None of the five existing migrations
are touched, so v1 functionality has zero exposure to these changes even
mid-rollout.

## G. API changes

No existing `/clinical/*` contract changes. New, additive:

- `/clinical/analyze` gains an optional `providerId`/`modelId` override in
  its request body (falls back to the registry's default), for callers
  who want to pin a specific model.
- New endpoints are additive, not replacements: patient-facing guidance
  reuses the *existing* stateless endpoints (`/clinical/red-flags`,
  `/clinical/missing-information`) behind the new patient-safety rephrase
  layer, rather than duplicating logic in new routes.
- API-key auth (milestone 2) will be an *additional* accepted auth method
  alongside the existing Supabase session check, not a replacement —
  today's authenticated-session requirement keeps working for the web app
  itself.

## H. AI provider migration (Anthropic → provider-agnostic)

Nothing in `core/src/stages/*.ts` changes — every stage already takes a
`ModelProvider` as a parameter, never a concrete class. The migration is:

1. Write `core/src/providers/openai.ts` and `.../google.ts`, matching
   `AnthropicProvider`'s shape (raw `fetch`, no SDK dependency, same
   `ModelProvider` interface).
2. Write `core/src/provider-registry.ts`: reads
   `AI_PROVIDER_DEFAULT`, `AI_PROVIDER_<STAGE>` env vars, constructs the
   matching provider instances, returns a `StageProviderMap`.
3. `web/lib/ai/orchestrator.ts`'s two factory functions call the registry
   instead of `new AnthropicProvider(...)` directly. This is a
   ~10-line change per function.
4. Existing tests (`core/test/orchestrator.test.ts`,
   `web/test/handlers.test.ts`) already inject providers via
   `MockProvider` / `statelessOrchestratorFactory` and are unaffected —
   they don't go through the registry at all. New tests are added
   specifically for the registry's config-resolution logic and for the
   failover decorator.

## I. Frontend migration

The clinician portal's route group, layout, and auth check are untouched.
New route groups are added alongside it:

- `web/app/(patient)/patient/...` — separate layout, separate auth check
  (via `patient_accounts`, not the clinician `users.role` check).
- `web/app/(hospital)/hospital/...` — reuses the existing
  `hospital_admin` role check already present in the data model; today
  a `hospital_admin` incorrectly lands on the clinician dashboard after
  onboarding (a known, previously-stated gap) — this milestone is what
  actually fixes that, by giving that role a real destination.
- `web/app/atlas/...` — public, no auth required, reads only from the
  publicly-readable knowledge tables.

No shared component in `web/components/` needs breaking changes; new
role-specific shells are added alongside `AppShell`, not instead of it.

## J. Knowledge architecture

Covered in `docs/KNOWLEDGE_ARCHITECTURE.md` (written once section F's
tables exist). Summary: entities and relationships are generic
(`knowledge_entities`/`knowledge_relationships` with a `type` /
`relationship_type` discriminator) rather than one table per clinical
concept (symptoms, conditions, red flags, ...) — this keeps the schema
from growing a new table for every new knowledge category the master
prompt lists, at the cost of needing application-level validation of
which relationship types are valid between which entity types.

## K. Evaluation architecture

`evaluation_cases` holds synthetic clinical pictures with an
expected/reference output; `evaluation/run-comparison.ts` runs each case
through every active `ai_models` row via the *existing* orchestrator
(same code path production uses, not a separate evaluation-only
pipeline), storing raw output in `evaluation_runs.output` and a
structured score in `evaluation_runs.score`. Milestone 1 deliberately
does not attempt to auto-score clinical quality (that's a hard, open
research problem the master prompt itself names in section 13) — it
records comparable outputs across providers for a human to review
side-by-side. Scoring automation is later work.

## L. Security and privacy

The single biggest new privacy surface is the patient layer:
`patient_consents` (section F) is the enforcement point ensuring a
patient's own login can never read clinician-authored case content about
them without an explicit consent row — this is checked in RLS, not just
in application code. Knowledge-graph tables are the deliberate opposite:
publicly readable by design, and structurally incapable of containing
patient data since nothing in that schema references `patients` or
`cases`. `evaluation_cases`/`evaluation_runs` never reference real patient
IDs, matching `supabase/seed.sql`'s existing synthetic-data-only
discipline.

## M. Testing strategy

Every new migration gets the same treatment as the existing five: applied
to a real local Postgres instance (not just written), with a scenario test
proving the new RLS policy does what it claims — the project's own
established pattern (`supabase/tests/`), not a new approach. The provider
registry gets unit tests resolving various env-var configurations to the
expected `StageProviderMap` shape, plus one live-network test per new
provider (mirroring the existing Anthropic adapter's real-401 test)
verifying the adapter parses that provider's actual error responses
correctly. Patient and hospital route additions get the same
handler-logic-plus-fake-Supabase-client pattern already used in
`web/test/handlers.test.ts`, not a new testing approach invented for them.

## N. Deployment changes

New environment variables (`AI_PROVIDER_DEFAULT` and per-provider API
keys) are additive to `web/.env.example` and to Vercel's project
settings — no existing variable is renamed or removed, so a deployment
with only `ANTHROPIC_API_KEY` set continues to build and run exactly as
today until the new variables are configured. No change to the build
command, the workspace configuration, or Supabase project settings beyond
running the new migrations.

## O. Migration sequence

```
Phase 1 — Provider abstraction        (no DB changes; lowest risk;
                                        covered by existing tests)
Phase 2 — Patient layer schema + UI   (independent of Phase 1;
                                        highest-caution phase — see Risks)
Phase 3 — Hospital layer queries + UI (independent of Phases 1–2;
                                        RLS support already exists)
Phase 4 — Knowledge graph schema
          + one Atlas page type       (independent of Phases 1–3)
Phase 5 — Evaluation skeleton         (depends on Phase 1 — comparing
                                        providers requires >1 to exist)
Phase 6 — API keys schema             (independent; enforcement deferred)
Phase 7 — Search                      (depends on Phase 4)
Phase 8 — UX polish, docs,
          contributor workflow        (depends on whichever of 2–4 shipped)
```

Phases 1–4 and 6 have no dependencies on each other and could in principle
run in any order or in parallel; they're numbered by risk (lowest first)
and by how directly they unblock later phases, not by a hard requirement.

## Risks and tradeoffs

- **Patient layer is the highest-liability addition.** Every patient-facing
  response must go through the hedging/rephrase layer (section D) before
  display — never surface a raw differential-with-named-diagnoses to a
  patient screen. Recommend a dedicated safety review of actual patient-
  facing copy before any real release, separate from normal code review.
- **Knowledge graph provenance is labor-intensive by design**, and that's
  intentional — the temptation to auto-generate entities at scale via an
  LLM would violate the "never manufacture citations" principle from both
  the v1 and v2 prompts. Milestone 1 should ship a small number of
  manually-curated, genuinely-cited entities, not a large auto-generated set.
- **Multi-provider JSON reliability varies.** The existing
  retry-once-on-malformed-JSON logic was tuned against Anthropic's actual
  behavior; other providers may need different retry counts or prompt
  adjustments to hit the same reliability bar — expect to revisit
  `core/src/json-utils.ts`'s retry constant per provider, not assume it
  transfers unchanged.
- **Hospital safety-signal detection risks both false positives (alert
  fatigue) and false negatives (missed real signals).** `diagnostic_reviews`
  models a flag for human attention specifically to avoid the system ever
  rendering a verdict — this needs conservative thresholds and should be
  treated as tunable, not fixed at first implementation.

---

## Implementation status (updated as phases land)

Branch `v2/multi-provider-patient-layer` implements, verified against the real repo
(72 JS tests; migrations 0001-0006 on real Postgres; existing 01 RLS suite and new 02 suite):

- **Phase 1 — multi-provider AI.** `core/src/provider-registry.ts`, OpenAI-compatible
  (covers local models), Google, and failover providers. `web/lib/ai/orchestrator.ts` now
  builds its provider map from env. With only `ANTHROPIC_API_KEY` set, behaviour is unchanged.
  See `docs/AI_PROVIDER_ARCHITECTURE.md`.
- **Phase 2a — patient identity and consent (migration 0006).** Also closes a v1 hole:
  0003's profile-update policy let any user promote themselves to `hospital_admin`.
- **Phase 2b — patient-safe guidance (`core/src/patient-safety/`).** Deterministic fixed copy;
  never shows a patient a diagnosis. Wording needs clinical review:
  `docs/PATIENT_COPY_FOR_CLINICAL_REVIEW.md`.

Deviations from the plan above, and why:
- **No `patient_accounts` table.** A `users` row with role `patient` already is the identity.
- **Consent is granted to a clinician, not per case.** A patient has no cases of their own
  until a clinician creates one.
- **Migration 0006 also replaces `handle_new_auth_user()` and adds a privilege-protection
  trigger on `users`** — the plan did not anticipate that the v1 signup trigger would turn a
  patient into a clinician, nor the self-promotion hole.

- **Phase 2c — patient routes and sign-up** (`docs/PATIENT_LAYER.md`): `/patient`, `/sign-up/patient`
  (closed behind `PATIENT_SIGNUP_ENABLED`), and a role guard that stops patients calling `/api/clinical/*`.

- **Phase 2d — consent sharing** (migration 0007, `/patient/sharing`, `/patient-reports`): clinicians generate
  a 7-day sharing code; patients enter it to share; reports are read through SECURITY DEFINER functions.

- **Phase 3a — facility ranking core** (`docs/FACILITY_RECOMMENDATION.md`): pure ranking function; quality first,
  connection only breaks exact ties and is disclosed; never affects emergency results.

- **Phase 4a — hospital safety layer, database** (migration 0008): signals, small-group suppression, review workflow.
- **Phase 5a — sign-up redesign** (`docs/ONBOARDING.md`, migration 0009): role-first sign-up, hospital facility-type fields, and a fix
  for a v1 bug that blocked every clinician and hospital from finishing onboarding.

Not yet done: facility directory tables and data, claim flow, patient facility UI, report-sharing to facilities, hospital layer, knowledge graph, evaluation, API keys.
