-- =============================================================================
-- Diagnowise — 0003_rls_policies.sql
--
-- Multi-tenant isolation model (spec §31: "organization-level isolation" +
-- "row-level security"):
--
--   * A user only ever sees rows belonging to their own organization.
--   * Within an organization, a clinician sees the cases they're assigned to;
--     a hospital_admin sees every case in the organization (they need
--     org-wide visibility for the Diagnostic Safety Platform to mean anything).
--   * A medical_student is treated as a clinician for visibility purposes.
--   * A researcher has no organization and no patient-data access at all —
--     they only reach anonymized/aggregate surfaces, which are out of scope
--     for this MVP phase (spec doc 2, §29: "do not attempt enterprise
--     infrastructure yet").
--   * Every child table (symptoms, diagnoses, red_flags, ...) inherits its
--     parent case's visibility via an EXISTS subquery — there is no
--     independent access path into clinical detail tables.
--
-- current_user_org_id() / current_user_role() are SECURITY DEFINER so that
-- policies on public.users itself don't recurse into RLS when evaluating
-- other policies that need to know who's asking.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.current_user_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- A case is visible to the current user if: same org, AND (they're the
-- assigned clinician OR they're a hospital_admin in that org).
create or replace function public.case_is_visible(target_case_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = target_case_id
      and c.organization_id = public.current_user_org_id()
      and (
        c.clinician_id = auth.uid()
        or public.current_user_role() = 'hospital_admin'
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.organizations         enable row level security;
alter table public.users                 enable row level security;
alter table public.patients              enable row level security;
alter table public.cases                 enable row level security;
alter table public.symptoms              enable row level security;
alter table public.diagnoses             enable row level security;
alter table public.red_flags             enable row level security;
alter table public.contradictions        enable row level security;
alter table public.investigations        enable row level security;
alter table public.follow_ups            enable row level security;
alter table public.case_timeline_events  enable row level security;
alter table public.ai_interactions       enable row level security;
alter table public.audit_logs            enable row level security;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create policy "members can view their own organization"
  on public.organizations for select
  using (id = public.current_user_org_id());

create policy "authenticated users can create an organization"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "hospital admins can update their own organization"
  on public.organizations for update
  using (id = public.current_user_org_id() and public.current_user_role() = 'hospital_admin');

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
create policy "users can view colleagues in their organization"
  on public.users for select
  using (
    id = auth.uid()
    or organization_id = public.current_user_org_id()
  );

create policy "users can update their own profile"
  on public.users for update
  using (id = auth.uid());

-- -----------------------------------------------------------------------------
-- patients
-- -----------------------------------------------------------------------------
create policy "org members can view their organization's patients"
  on public.patients for select
  using (organization_id = public.current_user_org_id());

create policy "clinicians and admins can register patients"
  on public.patients for insert
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('clinician', 'medical_student', 'hospital_admin')
  );

-- -----------------------------------------------------------------------------
-- cases
-- -----------------------------------------------------------------------------
create policy "clinicians can view their own cases"
  on public.cases for select
  using (
    organization_id = public.current_user_org_id()
    and clinician_id = auth.uid()
  );

create policy "hospital admins can view all organization cases"
  on public.cases for select
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() = 'hospital_admin'
  );

create policy "clinicians can create cases for themselves"
  on public.cases for insert
  with check (
    clinician_id = auth.uid()
    and public.current_user_role() in ('clinician', 'medical_student')
  );

create policy "assigned clinician can update their case"
  on public.cases for update
  using (clinician_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Child tables: visibility mirrors the parent case (via case_is_visible()).
-- Writes are restricted to the assigned clinician, since these represent
-- clinical judgment being recorded against a specific case.
-- -----------------------------------------------------------------------------
create policy "case-visible: select symptoms"
  on public.symptoms for select using (public.case_is_visible(case_id));
create policy "assigned clinician can write symptoms"
  on public.symptoms for insert with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );

create policy "case-visible: select diagnoses"
  on public.diagnoses for select using (public.case_is_visible(case_id));
create policy "assigned clinician can write diagnoses"
  on public.diagnoses for insert with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );

create policy "case-visible: select red_flags"
  on public.red_flags for select using (public.case_is_visible(case_id));
create policy "assigned clinician can write red_flags"
  on public.red_flags for insert with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );

create policy "case-visible: select contradictions"
  on public.contradictions for select using (public.case_is_visible(case_id));
create policy "assigned clinician can write contradictions"
  on public.contradictions for insert with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );

create policy "case-visible: select investigations"
  on public.investigations for select using (public.case_is_visible(case_id));
create policy "assigned clinician can write investigations"
  on public.investigations for insert with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );
create policy "assigned clinician can update investigations"
  on public.investigations for update using (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );

create policy "case-visible: select follow_ups"
  on public.follow_ups for select using (public.case_is_visible(case_id));
create policy "assigned clinician can write follow_ups"
  on public.follow_ups for insert with check (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );
create policy "assigned clinician can update follow_ups"
  on public.follow_ups for update using (
    exists (select 1 from public.cases c where c.id = case_id and c.clinician_id = auth.uid())
  );

create policy "case-visible: select case_timeline_events"
  on public.case_timeline_events for select using (public.case_is_visible(case_id));

create policy "case-visible: select ai_interactions"
  on public.ai_interactions for select using (public.case_is_visible(case_id));

-- -----------------------------------------------------------------------------
-- audit_logs — append-only, visible to the acting user and to hospital
-- admins of that user's organization (compliance oversight).
-- -----------------------------------------------------------------------------
create policy "users can view their own audit trail"
  on public.audit_logs for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = audit_logs.user_id
        and u.organization_id = public.current_user_org_id()
        and public.current_user_role() = 'hospital_admin'
    )
  );
