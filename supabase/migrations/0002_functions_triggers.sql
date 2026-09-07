-- =============================================================================
-- Diagnowise — 0002_functions_triggers.sql
--
-- Three concerns:
--   1. updated_at maintenance on users/cases
--   2. auto-creating a public.users profile row when someone signs up via
--      Supabase Auth (mirrors the onboarding flow: role/specialty/etc. are
--      filled in afterwards by an UPDATE from the onboarding wizard)
--   3. keeping cases.organization_id in sync with its patient's org, since
--      it's denormalized for RLS performance (see 0001 header)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.cases;
create trigger set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. auto-create profile on signup
--
-- SECURITY DEFINER: this needs to write to public.users on behalf of a
-- brand-new auth.users row, before that user has any RLS-granted access of
-- their own. role defaults to 'clinician'; the onboarding wizard updates it
-- (and specialty/organization_id) once the person answers the role question.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    'clinician'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 3. keep cases.organization_id in sync with patients.organization_id
-- -----------------------------------------------------------------------------
create or replace function public.sync_case_organization()
returns trigger
language plpgsql
as $$
begin
  select organization_id into new.organization_id
  from public.patients
  where id = new.patient_id;
  return new;
end;
$$;

drop trigger if exists sync_case_organization on public.cases;
create trigger sync_case_organization
  before insert or update of patient_id on public.cases
  for each row execute function public.sync_case_organization();
