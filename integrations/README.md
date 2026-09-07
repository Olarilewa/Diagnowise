# integrations/ — the Diagnowise API

**Status: `api/` — built (phase 3). `fhir/`, `hl7/` — future, not started.**

The public API lives in `web/app/api/clinical/*` rather than a separate
`integrations/api/` directory — Next.js's App Router requires route handlers
to live under `app/`, and duplicating them here would mean either a copy or
a build step nobody asked for. This directory documents what's there
instead of housing a second copy of it.

## What's built

All 7 endpoints from build doc §11:

| Endpoint | Type | What it does |
|---|---|---|
| `POST /clinical/analyze` | Stateful | Runs the full 7-stage pipeline against an existing case, persists the result, records an audit event. |
| `POST /clinical/differential` | Stateless | Differential diagnosis for a clinical picture supplied directly in the request — no Diagnowise case needed. |
| `POST /clinical/red-flags` | Stateless | Red-flag detection only. |
| `POST /clinical/missing-information` | Stateless | Highest-value missing-information questions. |
| `POST /clinical/contradictions` | Stateless | Checks a supplied working diagnosis against the picture (working diagnosis required). |
| `POST /clinical/follow-up` | Stateless | Follow-up plan. |
| `POST /clinical/explain` | Stateful, read-only | Returns the reasoning already recorded for a case+stage — never re-runs the model. |

**Stateful vs. stateless is the core design split.** `/clinical/analyze` and
`/clinical/explain` are tied to a Diagnowise case and its Supabase-backed
audit trail (`ai_interactions`). The other five accept a clinical picture
directly and don't require a case to exist — this is strategy doc §11's
"other healthcare applications should be able to use Diagnowise's clinical
reasoning without using the Diagnowise interface," made real rather than
aspirational. See `web/lib/ai/orchestrator.ts`'s `createStatelessOrchestrator`
docstring for the one real tradeoff this creates (no persisted audit trail
for stateless calls, by design — not an oversight).

Route handlers themselves (`web/app/api/clinical/*/route.ts`) are thin:
parse the request, build a Supabase client, call a handler function from
`web/lib/clinical/handlers.ts`, map the result through
`web/lib/utilities/route-helpers.ts`. All the actual logic — auth,
validation, orchestration, error mapping — is in plain, unit-tested
functions, not inline in the route files.

Every endpoint requires a standard authenticated Diagnowise session for
this MVP cut. A separate API-key mechanism for genuinely external,
non-Diagnowise-user callers (the literal "without using the Diagnowise
interface" scenario — a third party with no Diagnowise account at all) is
real, separate infrastructure work: an `api_keys` table, key issuance and
rotation, and rate limiting, none of which exists yet. Documented here as a
known gap, not silently assumed away.

## fhir/, hl7/ — still future

Mapping case/diagnosis/red-flag data onto FHIR resources and HL7 messages
for EHR interoperability. Explicitly out of scope per strategy doc §31
("do not build... FHIR servers" as standing infrastructure) — when this
happens, it means mapping functions, not a hosted FHIR server.
