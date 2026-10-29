-- =============================================================================
-- Diagnowise — 0008_hospital_safety.sql  (V2, Phase 4: hospital layer)
--
-- Organization-level diagnostic safety: signals, summaries, and a review workflow.
--
-- PRINCIPLES (from the V2 brief), enforced in the schema, not just in the UI:
--   * The system surfaces PATTERNS THAT MAY WARRANT REVIEW. It never states that a
--     clinician made a mistake. Signals are about cases and processes.
--   * Signals carry NO clinician identity. Department summaries suppress groups
--     with fewer than 3 clinicians (folded into "Other (small groups)") so a
--     number can't be read as one person's record. Residual, deliberate: an admin
--     can already open any case in their organization (0003), so the case list
--     still lets them find the treating clinician. Suppression stops *league
--     tables*, not case access.
--   * Reviews are a human workflow. The case's own clinician can read reviews on
--     their cases (transparency). All writes go through functions below.
--   * "Department" = the clinician's specialty for now. Real departments are a
--     later, additive change.
--
-- All functions return nothing for anyone who is not a hospital_admin, and only
-- ever the caller's own organization.
-- =============================================================================

-- ---- diagnostic_reviews ------------------------------------------------------
create table public.diagnostic_reviews (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flagged_by      uuid not null references public.users (id),
  reason          text not null check (length(trim(reason)) between 1 and 1000),
  status          text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by     uuid references public.users (id),
  review_note     text check (review_note is null or length(review_note) <= 2000),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (
    (status = 'open' and reviewed_by is null and reviewed_at is null)
    or (status <> 'open' and reviewed_by is not null and reviewed_at is not null)
  )
);
create index diagnostic_reviews_org_status_idx on public.diagnostic_reviews (organization_id, status);
create unique index diagnostic_reviews_one_open_per_case on public.diagnostic_reviews (case_id) where status = 'open';

alter table public.diagnostic_reviews enable row level security;
-- Read only. No insert/update/delete policy: writes happen via flag_case_for_review / resolve_review.
create policy "hospital admins read their organization's reviews" on public.diagnostic_reviews for select
  using (organization_id = public.current_user_org_id() and public.current_user_role() = 'hospital_admin');
create policy "clinicians read reviews on their own cases" on public.diagnostic_reviews for select
  using (exists (select 1 from public.cases c where c.id = diagnostic_reviews.case_id and c.clinician_id = auth.uid()));

-- ---- signals -----------------------------------------------------------------
-- Internal: every signal, no limit, used by the overview so counts are never truncated.
create or replace function public.hospital_signals_internal(p_days int default null)
returns table (case_id uuid, case_ref text, department text, case_status text, risk_level text, signal text, detail text, case_age_days int)
language sql security definer stable set search_path = public as $$
  with open_cases as (
    select c.id, p.external_reference as ref, coalesce(u.specialty, 'Unspecified') as dept,
           c.status, c.risk_level, c.created_at, greatest(0, current_date - c.created_at::date) as age
      from public.cases c
      join public.patients p on p.id = c.patient_id
      join public.users u on u.id = c.clinician_id
     where public.current_user_role() = 'hospital_admin'
       and c.organization_id = public.current_user_org_id()
       and c.status not in ('draft', 'resolved', 'archived')
       and (p_days is null or c.created_at >= now() - make_interval(days => p_days))
  ),
  s as (
    select o.id, 'overdue_follow_up'::text as signal,
           ('A follow-up is overdue' || case when min(f.due_date) is not null then ' (due ' || (current_date - min(f.due_date)) || ' days ago)' else '' end)::text as detail
      from open_cases o join public.follow_ups f on f.case_id = o.id
     where f.status = 'overdue' or (f.status = 'pending' and f.due_date < current_date)
     group by o.id
    union all
    select o.id, 'unresolved_high_risk'::text, ('High-risk case open for ' || o.age || ' days')::text
      from open_cases o where o.risk_level in ('high', 'critical') and o.age >= 14
    union all
    select o.id, 'reassessment_required'::text, 'The case is marked as needing reassessment'::text
      from open_cases o where o.status = 'reassessment_required'
    union all
    select o.id, 'contradiction_flagged'::text, 'A possible diagnostic contradiction was flagged and the case is still open'::text
      from open_cases o where exists (select 1 from public.contradictions k where k.case_id = o.id)
    union all
    select o.id, 'investigation_without_result'::text, (count(*) || ' ordered investigation(s) with no recorded result after 14+ days')::text
      from open_cases o join public.investigations i on i.case_id = o.id
     where i.status = 'ordered' and i.created_at < now() - interval '14 days'
     group by o.id
  )
  select b.id, b.ref, b.dept, b.status, b.risk_level, s.signal, s.detail, b.age::int
    from s join open_cases b on b.id = s.id;
$$;

create or replace function public.hospital_safety_signals(
  p_days int default null, p_signal text default null, p_status text default null,
  p_risk text default null, p_department text default null)
returns table (case_id uuid, case_ref text, department text, case_status text, risk_level text, signal text, detail text, case_age_days int)
language sql security definer stable set search_path = public as $$
  select * from public.hospital_signals_internal(p_days) g
   where (p_signal is null or g.signal = p_signal)
     and (p_status is null or g.case_status = p_status)
     and (p_risk is null or g.risk_level = p_risk)
     and (p_department is null or g.department = p_department)
   order by g.case_age_days desc, g.signal
   limit 500;
$$;

-- ---- overview ----------------------------------------------------------------
create or replace function public.hospital_overview(p_days int default null)
returns table (department text, signal text, case_count bigint)
language sql security definer stable set search_path = public as $$
  with scope as (
    select c.id, c.status, coalesce(u.specialty, 'Unspecified') as dept, c.clinician_id
      from public.cases c join public.users u on u.id = c.clinician_id
     where public.current_user_role() = 'hospital_admin'
       and c.organization_id = public.current_user_org_id()
       and c.status not in ('draft', 'archived')
       and (p_days is null or c.created_at >= now() - make_interval(days => p_days))
  ),
  size as (select dept, count(distinct clinician_id) as clinicians from scope group by dept),
  labelled as (
    select s.id, s.status,
           case when z.clinicians >= 3 then s.dept else 'Other (small groups)' end as department
      from scope s join size z on z.dept = s.dept
  ),
  sig as (select distinct case_id, signal from public.hospital_signals_internal(p_days))
  select * from (
  select l.department, 'open_cases'::text as signal, count(*) as case_count from labelled l where l.status <> 'resolved' group by l.department
  union all
  select 'All departments'::text, 'open_cases'::text, count(*) from labelled l where l.status <> 'resolved'
  union all
  select l.department, g.signal, count(distinct l.id) from labelled l join sig g on g.case_id = l.id group by l.department, g.signal
  union all
  select 'All departments'::text, g.signal, count(distinct l.id) from labelled l join sig g on g.case_id = l.id group by g.signal
  ) t
  -- Aggregates without GROUP BY return a row even for an empty input; return NOTHING to non-admins.
  where public.current_user_role() = 'hospital_admin'
  order by 1, 2;
$$;

-- ---- review workflow ---------------------------------------------------------
create or replace function public.flag_case_for_review(p_case_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'hospital_admin' then
    raise exception 'Only hospital administrators can flag cases for review.' using errcode = '42501';
  end if;
  v_org := public.current_user_org_id();
  if v_org is null or not exists (select 1 from public.cases where id = p_case_id and organization_id = v_org) then
    raise exception 'Case not found.' using errcode = 'P0002';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.' using errcode = '22023';
  end if;
  insert into public.diagnostic_reviews (case_id, organization_id, flagged_by, reason)
  values (p_case_id, v_org, auth.uid(), trim(p_reason)) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.resolve_review(p_review_id uuid, p_outcome text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'hospital_admin' then
    raise exception 'Only hospital administrators can resolve reviews.' using errcode = '42501';
  end if;
  if p_outcome not in ('reviewed', 'dismissed') then
    raise exception 'Outcome must be reviewed or dismissed.' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 2000 then
    raise exception 'Note is too long.' using errcode = '22023';
  end if;
  v_org := public.current_user_org_id();
  update public.diagnostic_reviews
     set status = p_outcome, reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_review_id and organization_id = v_org and status = 'open';
  if not found then
    raise exception 'Open review not found.' using errcode = 'P0002';
  end if;
end; $$;

create or replace function public.hospital_reviews(p_status text default null)
returns table (review_id uuid, case_id uuid, case_ref text, department text, status text, reason text, review_note text, created_at timestamptz, reviewed_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.id, r.case_id, p.external_reference, coalesce(u.specialty, 'Unspecified'), r.status, r.reason, r.review_note, r.created_at, r.reviewed_at
    from public.diagnostic_reviews r
    join public.cases c on c.id = r.case_id
    join public.patients p on p.id = c.patient_id
    join public.users u on u.id = c.clinician_id
   where public.current_user_role() = 'hospital_admin'
     and r.organization_id = public.current_user_org_id()
     and (p_status is null or r.status = p_status)
   order by r.created_at desc
   limit 500;
$$;

revoke all on function public.hospital_signals_internal(int) from public;
revoke all on function public.hospital_safety_signals(int, text, text, text, text) from public;
revoke all on function public.hospital_overview(int) from public;
revoke all on function public.flag_case_for_review(uuid, text) from public;
revoke all on function public.resolve_review(uuid, text, text) from public;
revoke all on function public.hospital_reviews(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.hospital_safety_signals(int, text, text, text, text) to authenticated;
    grant execute on function public.hospital_overview(int) to authenticated;
    grant execute on function public.flag_case_for_review(uuid, text) to authenticated;
    grant execute on function public.resolve_review(uuid, text, text) to authenticated;
    grant execute on function public.hospital_reviews(text) to authenticated;
  end if;
end $$;
