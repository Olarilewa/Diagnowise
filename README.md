# Diagnowise

Clinical intelligence and diagnostic safety infrastructure — for patients,
clinicians, and hospitals. See `docs/ARCHITECTURE.md` for the full picture;
this file is a map of the repo and how to stand up what's built so far.

## Repo layout

```
diagnowise-platform/
├── web/            Next.js app — real frontend (this phase) on top of the
│                    backend (phase 1), AI orchestration (phase 2), and
│                    public API (phase 3)
├── core/            @diagnowise/core — open-source reasoning engine
│                    (phase 2 — 19 tests passing)
├── supabase/        database schema, RLS policies, seed data, and two test
│                    harnesses (pure-SQL RLS checks, and an optional
│                    full-stack PostgREST verification)
├── integrations/    the /clinical/* API (done — see web/app/api/clinical/);
│                    FHIR, HL7 — future, not started
├── knowledge/       versioned clinical knowledge layer — future
├── evaluation/       clinical evaluation framework / benchmark — future
└── docs/
```

This is an npm workspace — `web` depends on `core` as a real local package
(`@diagnowise/core`), not a copy-pasted duplicate.

## What's built

**Phase 1 — backend.** Schema, auth wiring, Row-Level Security — verified
against real Postgres, not just read and assumed correct.

**Phase 2 — AI orchestration.** `core/`: provider-agnostic reasoning engine,
7 pipeline stages, retry + audit + overcertainty guardrails. 19 tests,
including a live call to `api.anthropic.com`.

**Phase 3 — the public API.** All 7 `/clinical/*` endpoints, stateful and
stateless. Persistence layer verified against a real PostgREST + Postgres
stack with a real signed JWT — caught two real RLS gaps before they shipped.

**Phase 4 — the real frontend (this phase).** The prototype that was
previously a standalone React artifact is now a real Next.js app in
`web/app/`, talking to the actual backend and API above — not mocked data.

- **Real Supabase Auth**: sign-up, sign-in, forgot-password, email
  confirmation callback, and session-refresh middleware. No more fake
  client-side-only auth state.
- **Real onboarding**: the wizard actually creates an organization row and
  updates the user's profile (role, specialty, organization) via a Server
  Action, not a client-side illusion of doing so.
- **Real landing page**: static marketing content with genuine Next.js
  routing (`<Link>`, real URLs, working browser back button) replacing the
  prototype's fake `useState`-based router.
- **Real clinician portal**: `/dashboard` fetches actual cases from
  Postgres through RLS (a clinician sees their own, a hospital admin would
  see their org's — see caveat below). `/cases/new` creates a real patient
  + case row, then calls the real `/clinical/analyze` pipeline (via a
  Server Action calling the handler directly — no self-HTTP-call
  overhead) and persists genuine AI-generated diagnoses, red flags, and a
  contradiction if one exists. `/cases/[id]` is the real Diagnostic
  Workspace, rendering actual database rows, with a working "Re-run
  diagnostic analysis" button.
- **Verified with a real `next build`**, not just `tsc --noEmit` — see
  `docs/ARCHITECTURE.md` for the one sandbox-specific wrinkle that came up
  (Google Fonts fetching at build time) and how it was worked around for
  verification purposes without changing the shipped code.

### Deliberately not ported yet

- **Hospital portal** (organization-wide dashboard, departments, alerts,
  reports) — the prototype's version used mocked, hand-written aggregate
  data; building the real thing needs department-level aggregation queries
  that don't exist yet. A `hospital_admin` who completes onboarding today
  lands on the clinician dashboard, which is not correct for that role —
  a known, stated limitation, not a silent one.
- **Patient portal** — patients were never modeled in the auth system (see
  phase 1's architecture notes); this needs its own design, not just a port.
- **Developer and Pricing marketing pages** — no data dependency, lowest
  priority, straightforward to port later.
- **Confirming a working diagnosis** — `persist-analysis.ts` deliberately
  never sets `cases.working_diagnosis` (spec §45: AI proposes, the
  clinician confirms). There's no UI action yet for a clinician to actually
  confirm one from the differential list, so it shows "Not yet confirmed by
  clinician" until that's built.

## Running it locally

```bash
npm install              # installs both workspaces, links @diagnowise/core
npm run typecheck        # builds core, typechecks core and web
npm test                 # builds core, runs core's 19 tests + web's 13
```

```bash
# 1. Create a Supabase project, run the five migrations in
#    supabase/migrations/ in order.
# 2. cd web && cp .env.example .env.local, fill in your project's keys
#    and an Anthropic API key.
cd web && npm run dev
```

To verify RLS without a Supabase project: `supabase/tests/README.md` (pure
SQL, fast) or `supabase/tests/full-stack/README.md` (real PostgREST + real
supabase-js client).

## What's next

Hospital portal, patient portal, developer/pricing pages (all noted above),
and a real external-facing API-key mechanism for genuinely third-party
`/clinical/*` callers (noted in `integrations/README.md`).
