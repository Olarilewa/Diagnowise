-- =============================================================================
-- Diagnowise — 0005_case_timeline_events_insert_policy.sql
--
-- Fixes a second real gap in the same class as 0004: 0003_rls_policies.sql
-- gave case_timeline_events a SELECT policy but no INSERT policy, so under
-- RLS every attempt to record a timeline event was silently rejected. Found
-- by running the actual persistence code (web/lib/clinical/persist-analysis.ts)
-- against a real PostgREST + Postgres stack with a real assigned-clinician
-- session — not caught by typechecking or the mocked unit tests, because
-- both of those assume writes succeed rather than exercising RLS itself.
--
-- Same fix pattern as 0004: assigned clinician can write, mirroring every
-- other child table.
-- =============================================================================

create policy "assigned clinician can write case_timeline_events"
  on public.case_timeline_events for insert
  with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );
