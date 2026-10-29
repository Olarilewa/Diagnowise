-- =============================================================================
-- Diagnowise — 0007_consent_sharing.sql  (V2, Phase 2d)
--
-- How a patient and a clinician find each other, safely.
--
-- Patients cannot search for clinicians (RLS hides other users) and a lookup
-- by email would let anyone probe which emails belong to clinicians. Instead a
-- clinician generates a short-lived SHARING CODE and gives it to the patient,
-- who enters it to grant consent. Everything runs through SECURITY DEFINER
-- functions; the two new tables have RLS enabled and NO policies, so no
-- client can read or write them directly.
--
--   * Codes are stored only as a SHA-256 hash. The plaintext is returned once.
--   * One active code per clinician; generating a new one replaces the old.
--   * Codes expire after 7 days.
--   * Failed attempts are recorded; 10 failures per patient per hour blocks
--     further attempts. Residual risk: patient accounts are cheap to create,
--     so this slows guessing rather than preventing it. A code is 40 bits and
--     sign-up requires email confirmation, which is what makes guessing
--     impractical; per-IP limiting at the edge is the proper complement.
--   * Failures return a status instead of raising, because a raised exception
--     would roll back the very attempt record the rate limit depends on.
--
-- Consent scope (shown to the patient in the UI): sharing lets the clinician
-- read ALL of the patient's reports, past and future, plus their display name,
-- until the patient stops sharing.
-- =============================================================================

create table public.clinician_share_codes (
  clinician_id uuid primary key references public.users (id) on delete cascade,
  code_hash    bytea not null unique,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create table public.consent_code_attempts (
  id           bigint generated always as identity primary key,
  patient_id   uuid not null references public.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index consent_code_attempts_lookup on public.consent_code_attempts (patient_id, attempted_at);

alter table public.clinician_share_codes  enable row level security;
alter table public.consent_code_attempts enable row level security;
-- (deliberately no policies: only the functions below may touch these tables)

create or replace function public.normalize_share_code(code text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.create_share_code()
returns table (share_code text, valid_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_exp  timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not public.is_care_provider(auth.uid()) then
    raise exception 'Only clinicians can create sharing codes.' using errcode = '42501';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.clinician_share_codes (clinician_id, code_hash, expires_at)
  values (auth.uid(), sha256(convert_to(v_code, 'UTF8')), v_exp)
  on conflict (clinician_id) do update
    set code_hash = excluded.code_hash, expires_at = excluded.expires_at, created_at = now();
  return query select substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5), v_exp;
end; $$;

create or replace function public.grant_consent_by_code(code text)
returns table (status text, consent_id uuid, clinician_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_norm     text := public.normalize_share_code(code);
  v_clin     uuid;
  v_name     text;
  v_existing uuid;
  v_new      uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'patient' then
    raise exception 'Only patient accounts can use a sharing code.' using errcode = '42501';
  end if;

  delete from public.consent_code_attempts where attempted_at < now() - interval '1 day';
  if (select count(*) from public.consent_code_attempts
       where patient_id = auth.uid() and attempted_at > now() - interval '1 hour') >= 10 then
    return query select 'rate_limited'::text, null::uuid, null::text;
    return;
  end if;

  select c.clinician_id, u.name into v_clin, v_name
    from public.clinician_share_codes c
    join public.users u on u.id = c.clinician_id
   where c.code_hash = sha256(convert_to(v_norm, 'UTF8')) and c.expires_at > now();

  if v_clin is null then
    insert into public.consent_code_attempts (patient_id) values (auth.uid());
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  select pc.id into v_existing from public.patient_consents pc
   where pc.patient_id = auth.uid() and pc.grantee_id = v_clin and pc.revoked_at is null;
  if v_existing is not null then
    return query select 'already_shared'::text, v_existing, v_name;
    return;
  end if;

  insert into public.patient_consents (patient_id, grantee_id) values (auth.uid(), v_clin) returning id into v_new;
  return query select 'ok'::text, v_new, v_name;
end; $$;

-- The patient's own consents, with the clinician's display name (which the patient
-- cannot otherwise read: RLS hides other users).
create or replace function public.my_consents()
returns table (consent_id uuid, clinician_name text, granted_at timestamptz, revoked_at timestamptz)
language sql security definer stable set search_path = public as $$
  select c.id, u.name, c.granted_at, c.revoked_at
    from public.patient_consents c join public.users u on u.id = c.grantee_id
   where c.patient_id = auth.uid()
   order by c.granted_at desc;
$$;

-- Reports shared with the calling clinician, with the patient's display name.
-- Deliberately no email and no other profile fields.
create or replace function public.shared_reports()
returns table (report_id uuid, patient_name text, summary text, onset text, severity text, urgency text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.id, p.name, r.summary, r.onset, r.severity, r.details ->> 'urgency', r.created_at
    from public.patient_reports r join public.users p on p.id = r.patient_id
   where public.has_active_consent(r.patient_id)
   order by r.created_at desc
   limit 200;
$$;

revoke all on function public.create_share_code()          from public;
revoke all on function public.grant_consent_by_code(text)  from public;
revoke all on function public.my_consents()                from public;
revoke all on function public.shared_reports()             from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.clinician_share_codes, public.consent_code_attempts from authenticated;
    grant execute on function public.create_share_code()         to authenticated;
    grant execute on function public.grant_consent_by_code(text) to authenticated;
    grant execute on function public.my_consents()               to authenticated;
    grant execute on function public.shared_reports()            to authenticated;
  end if;
end $$;
