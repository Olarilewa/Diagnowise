# RLS test harness (local, Supabase-free)

These two files let you verify `0003_rls_policies.sql` actually enforces
tenant isolation, against a plain local Postgres instance — no Supabase
project required. This is how the policies in this repo were verified
before being committed (not just eyeballed).

`00_local_auth_stub.sql` is **not** part of the real schema. It stubs the
two pieces of Supabase's built-in `auth` schema our migrations depend on
(`auth.users`, `auth.uid()`) so the real migration files can run unmodified
against vanilla Postgres. `auth.uid()` normally reads the JWT of the current
request; the stub reads a settable session variable instead, so a single
`psql` session can simulate different logged-in users by changing one
setting between statements.

## Running it

```bash
createdb diagnowise_test
psql -d diagnowise_test -f supabase/tests/00_local_auth_stub.sql
psql -d diagnowise_test -f supabase/migrations/0001_init_schema.sql
psql -d diagnowise_test -f supabase/migrations/0002_functions_triggers.sql
psql -d diagnowise_test -f supabase/migrations/0003_rls_policies.sql
psql -d diagnowise_test -f supabase/tests/01_rls_verification.sql
```

`01_rls_verification.sql` seeds two organizations (Northbridge General
Hospital, Riverside Clinic) with an admin and a clinician each, then runs as
a genuinely restricted role (`app_user` — RLS is bypassed for superusers and
table owners, so testing as the migration-running role would prove nothing)
switching identity via `set app.current_user_id = '<uuid>'` and asserting:

1. A clinician sees exactly the cases assigned to them.
2. A clinician cannot see another organization's patients.
3. A hospital admin sees every case in their organization, including ones
   assigned to other clinicians (org-wide safety oversight).
4. A hospital admin still cannot see another organization's cases.
5. Child-table data (red flags, etc.) is invisible cross-organization even
   when the parent case ID is known.
6. With no identity set, nothing is visible.

All six currently pass. If you change a policy in `0003_rls_policies.sql`,
re-run this before deploying — it takes about a second.
