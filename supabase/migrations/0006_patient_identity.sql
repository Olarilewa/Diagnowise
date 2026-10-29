-- =============================================================================
-- Diagnowise — 0006_patient_identity.sql  (V2, Phase 2a)
--
-- Patient identity, patient-authored reports, patient-controlled consent —
-- and a fix for a privilege-escalation hole in v1 that has to land first.
--
-- THE HOLE (v1): 0003's "users can update their own profile" policy has no
-- column restrictions, so any signed-in user could `update users set role =
-- 'hospital_admin'` on their own row and immediately gain org-wide case
-- visibility. Adding a 'patient' role on top of that would let a patient
-- promote themselves to clinician. Section 1-3 below close it first.
--
-- Everything is additive or a strict tightening. Existing v1 onboarding
-- (a new user sets role/specialty/organization once) still works.
-- =============================================================================

-- 1. Allow the 'patient' role ------------------------------------------------
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.users'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%clinician%';
  if c is not null then execute format('alter table public.users drop constraint %I', c); end if;
end $$;
alter table public.users add constraint users_role_check
  check (role in ('clinician', 'medical_student', 'hospital_admin', 'researcher', 'patient'));

-- 2. Signup: only 'patient' can be requested via metadata ---------------------
-- v1 made every signup a 'clinician'. A patient signing up must NOT become one.
-- Sign-up metadata is user-controlled, so it can only ever select the LOWER-
-- privilege patient role; any other value (including 'hospital_admin') is
-- ignored and falls through to the v1 default.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := 'clinician';
begin
  if new.raw_user_meta_data ->> 'account_type' = 'patient' then v_role := 'patient'; end if;
  insert into public.users (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email, v_role)
  on conflict (id) do nothing;
  return new;
end; $$;

-- 3. Close the self-promotion hole -------------------------------------------
-- Applies only to a user editing their OWN row (auth.uid() is null for the
-- service role, migrations and the SQL console, which stay unrestricted).
-- Residual, deliberate: at first onboarding a user may still attach themselves
-- to an organization by id. Org ids are not discoverable (organizations are
-- readable only by members) and v1 onboarding creates a fresh org; proper
-- invite-based membership is the real fix and is a later milestone.
create or replace function public.protect_user_privileges()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if old.role = 'patient' and new.role is distinct from 'patient' then
    raise exception 'A patient account cannot change role.' using errcode = '42501';
  end if;
  if new.role = 'patient' and old.role is distinct from 'patient' then
    raise exception 'Patient accounts are created at sign-up only.' using errcode = '42501';
  end if;
  if old.organization_id is not null then
    if new.role is distinct from old.role then
      raise exception 'Role is locked once attached to an organization.' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception 'Organization cannot be changed once set.' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists protect_user_privileges on public.users;
create trigger protect_user_privileges before update on public.users
  for each row execute function public.protect_user_privileges();

-- 4. Patient-authored reports -------------------------------------------------
-- Deliberately separate from clinician-authored `symptoms`: provenance stays
-- unambiguous (build doc §45), and nothing here touches a clinician's case.
create table public.patient_reports (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users (id) on delete cascade,
  summary    text not null check (length(trim(summary)) > 0),
  onset      text,
  severity   text check (severity in ('mild', 'moderate', 'severe')),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index patient_reports_patient_id_idx on public.patient_reports (patient_id);

-- 5. Patient-controlled consent ------------------------------------------------
-- A patient grants a specific clinician read access to their reports.
-- Revocation is a function, not an UPDATE, so a grant row can never be edited
-- (no re-pointing, no un-revoking).
create table public.patient_consents (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users (id) on delete cascade,
  grantee_id uuid not null references public.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (patient_id <> grantee_id)
);
create unique index patient_consents_one_active on public.patient_consents (patient_id, grantee_id) where revoked_at is null;

create or replace function public.is_care_provider(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.users where id = target and role in ('clinician', 'medical_student'));
$$;

create or replace function public.has_active_consent(target_patient uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.patient_consents c
    join public.users u on u.id = auth.uid()
    where c.patient_id = target_patient and c.grantee_id = auth.uid() and c.revoked_at is null
      and u.role in ('clinician', 'medical_student'));
$$;

create or replace function public.revoke_patient_consent(consent_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.patient_consents set revoked_at = now()
   where id = consent_id and patient_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'Consent not found or already revoked.' using errcode = 'P0002'; end if;
end; $$;
revoke all on function public.revoke_patient_consent(uuid) from public;

-- 6. RLS ----------------------------------------------------------------------
alter table public.patient_reports  enable row level security;
alter table public.patient_consents enable row level security;

create policy "patients manage their own reports" on public.patient_reports for all
  using (patient_id = auth.uid() and public.current_user_role() = 'patient')
  with check (patient_id = auth.uid() and public.current_user_role() = 'patient');
-- Hospital admins get NO access here, even in the same organization: patient-
-- submitted data is visible only to a clinician the patient explicitly chose.
create policy "consented clinicians can read reports" on public.patient_reports for select
  using (public.has_active_consent(patient_id));

create policy "patients view their consents" on public.patient_consents for select using (patient_id = auth.uid());
create policy "grantees view consents given to them" on public.patient_consents for select using (grantee_id = auth.uid());
create policy "patients grant consent to care providers" on public.patient_consents for insert
  with check (patient_id = auth.uid() and public.current_user_role() = 'patient'
              and public.is_care_provider(grantee_id) and revoked_at is null);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.revoke_patient_consent(uuid) to authenticated;
    revoke update, delete on public.patient_consents from authenticated;
  end if;
end $$;
