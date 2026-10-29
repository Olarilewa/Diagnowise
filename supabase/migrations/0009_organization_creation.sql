-- =============================================================================
-- Diagnowise — 0009_organization_creation.sql  (V2, Phase 5a: sign-up)
--
-- 1. FIXES A v1 BUG. Onboarding did `insert into organizations ... returning id`.
--    The insert policy allowed it, but RETURNING also needs the SELECT policy to
--    pass ("members can view their own organization"), and a brand-new user is
--    not a member yet, so the statement failed with "new row violates row-level
--    security policy". No clinician or hospital could finish onboarding.
--    create_organization() does it in one SECURITY DEFINER step: create the
--    organization, attach the caller, and set their role, atomically.
--
-- 2. Closes direct organization INSERTs. Previously any signed-in user could
--    insert unlimited organizations (the insert, without RETURNING, worked).
--    Now the only way to create one is create_organization(), and a user who
--    already belongs to an organization cannot create another.
--
-- 3. Adds the facility-type fields from the hospital sign-up design:
--    care_scope  general | specialist | other
--    care_scope_detail  required for specialist/other (e.g. "Paediatric oncology")
--    Existing organizations keep care_scope = NULL (unknown) and stay valid.
--
-- The role argument is limited to clinician, medical_student and hospital_admin.
-- Becoming hospital_admin here makes the caller the admin of the organization
-- they just created, and of nothing else.
-- =============================================================================

alter table public.organizations
  add column care_scope        text check (care_scope in ('general', 'specialist', 'other')),
  add column care_scope_detail text check (care_scope_detail is null or length(trim(care_scope_detail)) between 1 and 200);
alter table public.organizations
  add constraint organizations_scope_detail_required
  check (care_scope is null or care_scope = 'general' or care_scope_detail is not null);

drop policy if exists "authenticated users can create an organization" on public.organizations;

create or replace function public.create_organization(
  p_name              text,
  p_type              text default 'hospital',
  p_country           text default null,
  p_care_scope        text default null,
  p_care_scope_detail text default null,
  p_role              text default 'clinician')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_org  uuid;
  v_new  uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select role, organization_id into v_role, v_org from public.users where id = auth.uid();
  if v_role is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
  if v_role = 'patient' then
    raise exception 'Patient accounts cannot create organizations.' using errcode = '42501';
  end if;
  if v_org is not null then
    raise exception 'You already belong to an organization.' using errcode = 'P0001';
  end if;
  if p_role not in ('clinician', 'medical_student', 'hospital_admin') then
    raise exception 'Role must be clinician, medical_student or hospital_admin.' using errcode = '22023';
  end if;
  if p_name is null or length(trim(p_name)) not between 2 and 200 then
    raise exception 'The organization name must be 2 to 200 characters.' using errcode = '22023';
  end if;

  insert into public.organizations (name, type, country, care_scope, care_scope_detail)
  values (trim(p_name), p_type, nullif(trim(coalesce(p_country, '')), ''), p_care_scope, nullif(trim(coalesce(p_care_scope_detail, '')), ''))
  returning id into v_new;

  update public.users set organization_id = v_new, role = p_role where id = auth.uid();
  return v_new;
end; $$;

revoke all on function public.create_organization(text, text, text, text, text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_organization(text, text, text, text, text, text) to authenticated;
  end if;
end $$;
