-- =============================================================================
-- Diagnowise — 0004_ai_interactions_insert_policy.sql
--
-- Fixes a real gap found while building the AI orchestration layer (phase 2):
-- 0003_rls_policies.sql gave ai_interactions a SELECT policy but no INSERT
-- policy. Under RLS, no policy for an action means that action is denied —
-- so the assigned clinician's own session couldn't have logged a single AI
-- interaction. web/lib/ai/ (this phase) writes ai_interactions using the
-- requesting clinician's normal RLS-respecting session, matching every
-- other child table's write pattern (see 0003's header) rather than
-- reaching for a service-role bypass — one consistent security model
-- throughout, not a special case for AI-generated rows.
--
-- Not folded into 0003 directly: migrations that have already shipped are
-- treated as immutable here, same as you'd do against a real deployed
-- database — you add a new migration, you don't rewrite history.
-- =============================================================================

create policy "assigned clinician can write ai_interactions"
  on public.ai_interactions for insert
  with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );
