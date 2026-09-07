# lib/clinical/ — clinical domain logic (built, phase 3)

- **`persist-analysis.ts`** — maps a `core/` `CaseAnalysisResult` onto the
  `diagnoses` / `red_flags` / `contradictions` / `investigations` /
  `follow_ups` / `case_timeline_events` rows from the backend phase. Writes
  through the caller's own RLS-scoped session throughout — every insert
  targets a table whose RLS policy requires the caller to be the case's
  assigned clinician, so persisting on behalf of a case the caller doesn't
  own fails at the database, not just the application layer. Verified
  against a real PostgREST + Postgres stack, not just typechecked — see
  `supabase/tests/full-stack/README.md`, including the two real bugs that
  verification caught.

- **`handlers.ts`** — the actual logic behind all 7 `/clinical/*` endpoints
  (`app/api/clinical/*/route.ts` are thin wrappers around these). Plain,
  testable functions — no `NextRequest`/`NextResponse` — so they're unit
  tested with a mocked Supabase client and a real `core/` orchestrator
  backed by `MockProvider`, without booting a Next.js server. See
  `../../test/handlers.test.ts`.

Kept separate from `lib/database/` (pure data access) and `lib/ai/`
(calling the reasoning engine, auditing it) so clinical rules stay legible
and testable on their own, per build doc §33's "keep business logic out of
UI components" — extended here to also mean "out of the database layer."
