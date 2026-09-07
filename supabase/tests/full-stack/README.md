# Full-stack verification (optional, advanced)

Everything else in `supabase/tests/` verifies RLS with plain SQL against a
bare Postgres instance. This directory goes one step further: it proves
`web/lib/clinical/persist-analysis.ts` works against a **real PostgREST +
Postgres stack, through real RLS, using the real `@supabase/supabase-js`
client with a real signed JWT** — not a mock of any of those things.

This is genuinely how this code was verified before shipping, not a
theoretical "you could also do this." It found two real bugs that neither
`tsc` nor the mocked unit tests caught:

1. `persist-analysis.ts` wasn't checking the error from two of its
   `case_timeline_events` inserts — they were failing silently.
2. `case_timeline_events` had no RLS **INSERT** policy at all (only SELECT),
   so those inserts were failing for a real, structural reason: RLS denies
   by default when no policy matches. Fixed in
   `supabase/migrations/0005_case_timeline_events_insert_policy.sql`.

It's kept separate from the regular test suite (`npm test`) because it
needs a real PostgREST binary, which isn't an npm dependency — reproducing
it is a few manual steps, not a single command.

## Why a reverse proxy is involved

`@supabase/supabase-js` always requests `<url>/rest/v1/<table>` — that's
where Supabase's Kong gateway routes to PostgREST in production. A bare
PostgREST instance serves tables at the root path (`/`). `rest_v1_proxy.mjs`
is a ~20-line reverse proxy that strips the `/rest/v1` prefix, which is
what Kong is actually doing in the real thing. Without it, every request
404s with `PGRST125`, which looks like an auth problem and isn't one.

## Reproducing it

```bash
# 1. Download PostgREST (no apt package; this is the official release binary)
curl -sL -o postgrest.tar.xz \
  https://github.com/PostgREST/postgrest/releases/download/v16.2/postgrest-v16.2-linux-static-x86-64.tar.xz
tar -xf postgrest.tar.xz

# 2. Set up a throwaway database with the REAL migrations plus this
#    directory's PostgREST-compatible auth stub (auth.uid() reads
#    PostgREST's request.jwt.claims GUC, matching real Supabase — this is
#    different from supabase/tests/00_local_auth_stub.sql, which uses a
#    simpler session-variable stub sufficient for pure-SQL RLS testing but
#    not for exercising a real JWT-authenticated client)
createdb diagnowise_e2e
psql -d diagnowise_e2e -f supabase/tests/full-stack/00_postgrest_auth_stub.sql
psql -d diagnowise_e2e -f supabase/migrations/0001_init_schema.sql
psql -d diagnowise_e2e -f supabase/migrations/0002_functions_triggers.sql
psql -d diagnowise_e2e -f supabase/migrations/0003_rls_policies.sql
psql -d diagnowise_e2e -f supabase/migrations/0004_ai_interactions_insert_policy.sql
psql -d diagnowise_e2e -f supabase/migrations/0005_case_timeline_events_insert_policy.sql

# 3. Grant table privileges to PostgREST's roles — must run AFTER the
#    schema exists, which is why this isn't folded into step 2's SQL file
psql -d diagnowise_e2e -c "
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated, anon;
"

# 4. Seed one organization, one clinician, one patient, one case (adjust
#    IDs to match persist-analysis.e2e.mjs if you change them)
# ... see supabase/seed.sql for the pattern; case_id must match
#     CASE_ID in persist-analysis.e2e.mjs

# 5. Bundle the module under test (it has an @/ path alias and TS types
#    that plain node can't run directly)
cd web
npx esbuild lib/clinical/persist-analysis.ts --bundle --platform=node \
  --format=esm --outfile=../supabase/tests/full-stack/persist-analysis.bundle.mjs \
  --external:@supabase/supabase-js --alias:@=.

# 6. Start PostgREST and the proxy, then run the test — all in one shell
#    invocation. (Background processes started in one tool call don't
#    survive into a separate one in some sandboxed environments — if
#    you hit ECONNREFUSED, that's why. A plain terminal doesn't have
#    this problem.)
POSTGREST_PORT=3111 ./postgrest postgrest.conf &
node rest_v1_proxy.mjs &
sleep 2
node persist-analysis.e2e.mjs
```

Expected output ends with:

```
✅ All real end-to-end assertions passed: persistCaseAnalysis works against
   a live PostgREST+Postgres stack, through real RLS, with the real
   @supabase/supabase-js client.
```

## What it doesn't cover

This proves the persistence layer's database interaction is correct. It
does not exercise Next.js's Route Handlers themselves (`app/api/clinical/*`)
— those are typechecked against the real `next` package's types but not
booted with `next dev`, since doing so needs at least a minimal `app/`
shell (layout, etc.) that doesn't exist yet in this backend-only phase. See
the root README's "What's next" section.
