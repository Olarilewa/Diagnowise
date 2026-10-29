-- Verifies 0008. Run on a clean database after the full chain (00 stub, 0001-0008).
\set ON_ERROR_STOP on
create or replace function public.test_expect_fail(tag text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'PASS %: rejected (%)', tag, sqlerrm; return; end;
  raise exception 'FAIL %: statement was allowed: %', tag, stmt;
end $$;
create or replace function public.test_expect_eq(tag text, got bigint, want bigint) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: got %, wanted %', tag, got, want; end if;
  raise notice 'PASS %: %', tag, got;
end $$;
create or replace function public.test_expect_text(tag text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: got %, wanted %', tag, got, want; end if;
  raise notice 'PASS %: %', tag, got;
end $$;
create or replace function public.test_expect_rows(tag text, stmt text, want bigint) returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt; get diagnostics n = row_count;
  if n <> want then raise exception 'FAIL %: % rows affected, wanted %', tag, n, want; end if;
  raise notice 'PASS %: % rows', tag, n;
end $$;
create table public.test_ids (k text primary key, v uuid);

insert into public.organizations (id, name) values ('00000000-0000-0000-0000-0000000000a1','Hospital A'),('00000000-0000-0000-0000-0000000000a2','Hospital B');
insert into auth.users (id, email, raw_user_meta_data) values
 ('f1000000-0000-0000-0000-000000000001','adminA@x.org','{"name":"Admin A"}'),
 ('f1000000-0000-0000-0000-000000000002','adminB@x.org','{"name":"Admin B"}'),
 ('f1000000-0000-0000-0000-000000000011','a1@x.org','{"name":"Dr A1"}'),
 ('f1000000-0000-0000-0000-000000000012','a2@x.org','{"name":"Dr A2"}'),
 ('f1000000-0000-0000-0000-000000000013','a3@x.org','{"name":"Dr A3"}'),
 ('f1000000-0000-0000-0000-000000000014','a4@x.org','{"name":"Dr A4"}'),
 ('f1000000-0000-0000-0000-000000000021','b1@x.org','{"name":"Dr B1"}'),
 ('f1000000-0000-0000-0000-000000000031','pat@x.org','{"account_type":"patient","name":"A Patient"}');
update public.users set role='hospital_admin', organization_id='00000000-0000-0000-0000-0000000000a1' where id='f1000000-0000-0000-0000-000000000001';
update public.users set role='hospital_admin', organization_id='00000000-0000-0000-0000-0000000000a2' where id='f1000000-0000-0000-0000-000000000002';
update public.users set organization_id='00000000-0000-0000-0000-0000000000a1', specialty='Internal Medicine' where id in ('f1000000-0000-0000-0000-000000000011','f1000000-0000-0000-0000-000000000012','f1000000-0000-0000-0000-000000000013');
update public.users set organization_id='00000000-0000-0000-0000-0000000000a1', specialty='Neurology' where id='f1000000-0000-0000-0000-000000000014';
update public.users set organization_id='00000000-0000-0000-0000-0000000000a2', specialty='Internal Medicine' where id='f1000000-0000-0000-0000-000000000021';

insert into public.patients (id, organization_id, external_reference, age, sex) values
 ('b1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','PT-A1',50,'male'),
 ('b1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','PT-A2',40,'female'),
 ('b1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','PT-A3',60,'male'),
 ('b1000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a1','PT-A4',70,'female'),
 ('b1000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000a1','PT-A5',55,'male'),
 ('b1000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a2','PT-B1',45,'male');
insert into public.cases (id, patient_id, clinician_id, status, risk_level, created_at) values
 ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000011','active','high', now() - interval '20 days'),
 ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000012','reassessment_required','low', now()),
 ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000013','active','low', now() - interval '30 days'),
 ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000004','f1000000-0000-0000-0000-000000000014','active','critical', now() - interval '40 days'),
 ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000005','f1000000-0000-0000-0000-000000000011','resolved','high', now() - interval '60 days'),
 ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000011','f1000000-0000-0000-0000-000000000021','reassessment_required','low', now());
insert into public.follow_ups (case_id, due_date, status) values
 ('c1000000-0000-0000-0000-000000000001', current_date - 5, 'pending'),
 ('c1000000-0000-0000-0000-000000000005', current_date - 9, 'overdue');
insert into public.contradictions (case_id, summary, inconsistencies) values ('c1000000-0000-0000-0000-000000000001','may not explain the picture','["x"]');
insert into public.investigations (case_id, name, status, created_at) values
 ('c1000000-0000-0000-0000-000000000003','Endoscopy','ordered', now() - interval '20 days'),
 ('c1000000-0000-0000-0000-000000000003','Blood panel','suggested', now() - interval '25 days');

do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if; end $$;
grant usage on schema public to app_user; grant select,insert,update,delete on all tables in schema public to app_user; grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user; grant execute on function auth.uid() to app_user;

set role app_user;
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000001',false) \gset
-- signals
select public.test_expect_eq('T1 admin A sees 6 signals across 4 open cases', (select count(*) from public.hospital_safety_signals()), 6);
select public.test_expect_eq('T2a unresolved_high_risk', (select count(*) from public.hospital_safety_signals() where signal='unresolved_high_risk'), 2);
select public.test_expect_eq('T2b overdue_follow_up', (select count(*) from public.hospital_safety_signals() where signal='overdue_follow_up'), 1);
select public.test_expect_eq('T2c reassessment_required', (select count(*) from public.hospital_safety_signals() where signal='reassessment_required'), 1);
select public.test_expect_eq('T2d contradiction_flagged', (select count(*) from public.hospital_safety_signals() where signal='contradiction_flagged'), 1);
select public.test_expect_eq('T2e investigation_without_result counts only ORDERED, not merely suggested', (select count(*) from public.hospital_safety_signals() where signal='investigation_without_result'), 1);
select public.test_expect_text('T2f the count in that detail is 1', (select detail from public.hospital_safety_signals() where signal='investigation_without_result'), '1 ordered investigation(s) with no recorded result after 14+ days');
select public.test_expect_eq('T3 a RESOLVED case raises no signals even with an overdue follow-up', (select count(*) from public.hospital_safety_signals() where case_ref='PT-A5'), 0);
select public.test_expect_eq('T4 another organization''s case is invisible', (select count(*) from public.hospital_safety_signals() where case_ref='PT-B1'), 0);
-- filters
select public.test_expect_eq('T5a filter by signal', (select count(*) from public.hospital_safety_signals(null,'unresolved_high_risk')), 2);
select public.test_expect_eq('T5b filter by risk', (select count(*) from public.hospital_safety_signals(null,null,null,'critical')), 1);
select public.test_expect_eq('T5c filter by department', (select count(*) from public.hospital_safety_signals(null,null,null,null,'Neurology')), 1);
select public.test_expect_eq('T5d filter by period (cases created in last 10 days)', (select count(*) from public.hospital_safety_signals(10)), 1);
select public.test_expect_eq('T5e filter by status', (select count(*) from public.hospital_safety_signals(null,null,'reassessment_required')), 1);
-- overview and small-group suppression
select public.test_expect_eq('T6a all departments: 4 open cases', (select case_count from public.hospital_overview() where department='All departments' and signal='open_cases'), 4);
select public.test_expect_eq('T6b Internal Medicine (3 clinicians) is shown: 3 open', (select case_count from public.hospital_overview() where department='Internal Medicine' and signal='open_cases'), 3);
select public.test_expect_eq('T6c the 1-clinician Neurology group is NEVER shown by name', (select count(*) from public.hospital_overview() where department='Neurology'), 0);
select public.test_expect_eq('T6d ...it is folded into "Other (small groups)"', (select case_count from public.hospital_overview() where department='Other (small groups)' and signal='open_cases'), 1);
select public.test_expect_eq('T6e totals still include the suppressed group', (select case_count from public.hospital_overview() where department='All departments' and signal='unresolved_high_risk'), 2);
select public.test_expect_eq('T6f ...and the folded group carries its signal', (select case_count from public.hospital_overview() where department='Other (small groups)' and signal='unresolved_high_risk'), 1);
-- no clinician identity in any output
reset role;
select public.test_expect_eq('T7 no output function exposes a clinician, email, or name column', (select count(*) from pg_proc p where p.proname in ('hospital_safety_signals','hospital_overview','hospital_reviews') and pg_get_function_result(p.oid) ~* '(clinician|email|name|flagged_by|reviewed_by)'), 0);
set role app_user;
-- who can see anything
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T8a a clinician gets no signals', (select count(*) from public.hospital_safety_signals()), 0);
select public.test_expect_eq('T8b ...and no overview', (select count(*) from public.hospital_overview()), 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000031',false) \gset
select public.test_expect_eq('T8c a patient gets nothing', (select count(*) from public.hospital_safety_signals()), 0);
select set_config('app.current_user_id','',false) \gset
select public.test_expect_eq('T8d an anonymous caller gets nothing', (select count(*) from public.hospital_overview()), 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_eq('T8e admin B sees only their own signal', (select count(*) from public.hospital_safety_signals()), 1);
select public.test_expect_text('T8f ...and it is their own case', (select case_ref from public.hospital_safety_signals()), 'PT-B1');
select public.test_expect_eq('T8g admin B overview is isolated too', (select case_count from public.hospital_overview() where department='All departments' and signal='open_cases'), 1);

-- review workflow
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000001',false) \gset
select public.flag_case_for_review('c1000000-0000-0000-0000-000000000001', '  Long-open high-risk case, overdue follow-up  ');
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_fail('T9a a clinician cannot flag a case', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000001','x')$q$);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T9b cannot flag another organization''s case', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000011','x')$q$);
select public.test_expect_fail('T9c an empty reason is rejected', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000002','   ')$q$);
select public.test_expect_fail('T9d an over-long reason is rejected', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000002', repeat('x',1001))$q$);
select public.test_expect_fail('T9e a second open flag on the same case is rejected', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000001','again')$q$);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_fail('T9f another organization''s admin cannot flag it either', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000001','x')$q$);

-- who can read the review
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000001',false) \gset
insert into public.test_ids select 'r1', id from public.diagnostic_reviews where case_id='c1000000-0000-0000-0000-000000000001' and status='open';
select public.test_expect_eq('T10a the admin can read it', (select count(*) from public.diagnostic_reviews), 1);
select public.test_expect_text('T10b the reason was trimmed and stored', (select reason from public.diagnostic_reviews), 'Long-open high-risk case, overdue follow-up');
select public.test_expect_fail('T10c direct INSERT is closed even to admins', $q$insert into public.diagnostic_reviews (case_id, organization_id, flagged_by, reason) values ('c1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1', auth.uid(), 'x')$q$);
select public.test_expect_rows('T10d direct UPDATE changes nothing', $q$update public.diagnostic_reviews set reason='tampered'$q$, 0);
select public.test_expect_rows('T10e direct DELETE removes nothing', $q$delete from public.diagnostic_reviews$q$, 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T10f the case''s own clinician can see the review on their case', (select count(*) from public.diagnostic_reviews), 1);
select public.test_expect_eq('T10g ...but gets nothing from the admin-only listing', (select count(*) from public.hospital_reviews()), 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000012',false) \gset
select public.test_expect_eq('T10h a different clinician cannot see it', (select count(*) from public.diagnostic_reviews), 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000031',false) \gset
select public.test_expect_eq('T10i a patient cannot see it', (select count(*) from public.diagnostic_reviews), 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_eq('T10j the other organization''s admin cannot see it', (select count(*) from public.diagnostic_reviews), 0);
select public.test_expect_eq('T10k ...nor via the listing', (select count(*) from public.hospital_reviews()), 0);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_text('T11 the listing shows the case reference and status', (select case_ref || '/' || status from public.hospital_reviews()), 'PT-A1/open');

-- resolving
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_fail('T12a a clinician cannot resolve a review', $q$select public.resolve_review((select v from public.test_ids where k='r1'),'dismissed')$q$);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_fail('T12b another organization''s admin cannot resolve it', $q$select public.resolve_review((select v from public.test_ids where k='r1'),'dismissed')$q$);
select set_config('app.current_user_id','f1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T12c an unknown outcome is rejected', $q$select public.resolve_review((select v from public.test_ids where k='r1'),'approved')$q$);
select public.resolve_review((select v from public.test_ids where k='r1'), 'reviewed', 'Follow-up booked with the clinician.');
select public.test_expect_text('T12d resolved with a note', (select status || '/' || review_note from public.hospital_reviews()), 'reviewed/Follow-up booked with the clinician.');
select public.test_expect_fail('T12e a resolved review cannot be resolved again', $q$select public.resolve_review((select v from public.test_ids where k='r1'),'dismissed')$q$);
select public.test_expect_text('T12f the case can be flagged again after resolution', (select (public.flag_case_for_review('c1000000-0000-0000-0000-000000000001','second look'))::text is not null)::text, 'true');
reset role;
select public.test_expect_eq('T13 who resolved it and when are recorded', (select count(*) from public.diagnostic_reviews where status='reviewed' and reviewed_by='f1000000-0000-0000-0000-000000000001' and reviewed_at is not null), 1);
select public.test_expect_fail('T14 an inconsistent state is impossible even for a superuser', $q$update public.diagnostic_reviews set status='reviewed' where status='open'$q$);
set role app_user;
select set_config('app.current_user_id','',false) \gset
select public.test_expect_fail('T15a anonymous cannot flag', $q$select public.flag_case_for_review('c1000000-0000-0000-0000-000000000002','x')$q$);
select public.test_expect_fail('T15b anonymous cannot resolve', $q$select public.resolve_review(gen_random_uuid(),'dismissed')$q$);
reset role;
