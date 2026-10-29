-- Verifies 0006. Run after the baseline (full chain 0001-0005, or 02a slice) + 0006.
-- Every assertion raises on failure; ON_ERROR_STOP makes a failure exit non-zero.
\set ON_ERROR_STOP on
create function public.test_expect_fail(tag text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'PASS %: rejected (%)', tag, sqlerrm; return; end;
  raise exception 'FAIL %: statement was allowed: %', tag, stmt;
end $$;
create function public.test_expect_eq(tag text, got bigint, want bigint) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: got %, wanted %', tag, got, want; end if;
  raise notice 'PASS %: %', tag, got;
end $$;
create function public.test_expect_rows(tag text, stmt text, want bigint) returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt; get diagnostics n = row_count;
  if n <> want then raise exception 'FAIL %: % rows affected, wanted %', tag, n, want; end if;
  raise notice 'PASS %: % rows', tag, n;
end $$;
create table public.test_ids (k text primary key, v uuid);

insert into public.organizations (id, name) values ('00000000-0000-0000-0000-0000000000a1','Hospital A'),('00000000-0000-0000-0000-0000000000a2','Hospital B');
insert into auth.users (id, email, raw_user_meta_data) values
 ('a1000000-0000-0000-0000-000000000001','pat1@x.org','{"account_type":"patient"}'),
 ('a1000000-0000-0000-0000-000000000002','pat2@x.org','{"account_type":"patient"}'),
 ('a1000000-0000-0000-0000-000000000011','cl1@x.org','{}'),
 ('a1000000-0000-0000-0000-000000000012','cl2@x.org','{}'),
 ('a1000000-0000-0000-0000-000000000021','adm@x.org','{}'),
 ('a1000000-0000-0000-0000-000000000031','spoof@x.org','{"account_type":"hospital_admin"}'),
 ('a1000000-0000-0000-0000-000000000041','newc@x.org','{}');
update public.users set organization_id='00000000-0000-0000-0000-0000000000a1', specialty='IM' where id in ('a1000000-0000-0000-0000-000000000011','a1000000-0000-0000-0000-000000000012');
update public.users set role='hospital_admin', organization_id='00000000-0000-0000-0000-0000000000a1' where id='a1000000-0000-0000-0000-000000000021';
insert into public.patients (id, organization_id, external_reference, age, sex) values ('b1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','PT-9001',48,'male');
insert into public.cases (patient_id, clinician_id, presenting_complaint) values ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000011','a clinician case');
do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if; end $$;
grant usage on schema public to app_user; grant select,insert,update,delete on all tables in schema public to app_user; grant execute on all functions in schema public to app_user;
-- these tests call auth.uid() directly in their statements (real Supabase already lets `authenticated` do this)
grant usage on schema auth to app_user; grant execute on function auth.uid() to app_user;

select public.test_expect_eq('T1a patient signup -> role patient', (select count(*) from public.users where id in ('a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002') and role='patient'), 2);
select public.test_expect_eq('T1b ordinary signup -> clinician (v1 default kept)', (select count(*) from public.users where id='a1000000-0000-0000-0000-000000000011' and role='clinician'), 1);
select public.test_expect_eq('T1c signup metadata cannot request hospital_admin', (select count(*) from public.users where id='a1000000-0000-0000-0000-000000000031' and role='clinician'), 1);

set role app_user;
-- patient cannot escalate
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T2a patient -> clinician', $q$update public.users set role='clinician' where id=auth.uid()$q$);
select public.test_expect_fail('T2b patient -> hospital_admin', $q$update public.users set role='hospital_admin' where id=auth.uid()$q$);
select public.test_expect_fail('T2c patient -> researcher', $q$update public.users set role='researcher' where id=auth.uid()$q$);
-- onboarded clinician cannot self-promote or hop org (the v1 hole)
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_fail('T3a clinician -> hospital_admin (v1 hole closed)', $q$update public.users set role='hospital_admin' where id=auth.uid()$q$);
select public.test_expect_fail('T3b clinician cannot switch organization', $q$update public.users set organization_id='00000000-0000-0000-0000-0000000000a2' where id=auth.uid()$q$);
select public.test_expect_fail('T3c clinician cannot become a patient', $q$update public.users set role='patient' where id=auth.uid()$q$);
select public.test_expect_rows('T3d clinician can still edit name/specialty', $q$update public.users set name='Dr One', specialty='Cardiology' where id=auth.uid()$q$, 1);
-- v1 onboarding shape still works exactly once
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000041',false) \gset
select public.test_expect_rows('T4a v1 onboarding (specialty+org) still works', $q$update public.users set specialty='IM', organization_id='00000000-0000-0000-0000-0000000000a1' where id=auth.uid()$q$, 1);
select public.test_expect_fail('T4b ...but org is then locked', $q$update public.users set organization_id='00000000-0000-0000-0000-0000000000a2' where id=auth.uid()$q$);
select public.test_expect_fail('T4c ...and role is locked', $q$update public.users set role='hospital_admin' where id=auth.uid()$q$);

-- patient reports
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_eq('T5a patient2 sees no reports yet', (select count(*) from public.patient_reports), 0);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_rows('T5b patient1 can file a report', $q$insert into public.patient_reports (patient_id, summary, severity) values (auth.uid(), 'stomach pain for 4 months', 'moderate')$q$, 1);
select public.test_expect_eq('T5c patient1 sees own report', (select count(*) from public.patient_reports), 1);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_fail('T5d patient2 cannot file a report as patient1', $q$insert into public.patient_reports (patient_id, summary) values ('a1000000-0000-0000-0000-000000000001','forged')$q$);
select public.test_expect_eq('T5e patient2 still sees nothing of patient1', (select count(*) from public.patient_reports), 0);
-- patients cannot see clinician cases
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_eq('T5f patient sees no clinician cases', (select count(*) from public.cases), 0);

-- consent
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T6a clinician WITHOUT consent sees 0 reports', (select count(*) from public.patient_reports), 0);
select public.test_expect_eq('T6b clinician sees own case', (select count(*) from public.cases), 1);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T6c patient cannot grant consent to a hospital_admin', $q$insert into public.patient_consents (patient_id, grantee_id) values (auth.uid(),'a1000000-0000-0000-0000-000000000021')$q$);
select public.test_expect_fail('T6d patient cannot grant consent to another patient', $q$insert into public.patient_consents (patient_id, grantee_id) values (auth.uid(),'a1000000-0000-0000-0000-000000000002')$q$);
select public.test_expect_rows('T6e patient grants consent to clinician 1', $q$insert into public.patient_consents (patient_id, grantee_id) values (auth.uid(),'a1000000-0000-0000-0000-000000000011')$q$, 1);
insert into public.test_ids select 'c1', id from public.patient_consents where patient_id = auth.uid();
select public.test_expect_fail('T6f duplicate active grant rejected', $q$insert into public.patient_consents (patient_id, grantee_id) values (auth.uid(),'a1000000-0000-0000-0000-000000000011')$q$);
select public.test_expect_rows('T6g grant rows cannot be edited directly', $q$update public.patient_consents set grantee_id='a1000000-0000-0000-0000-000000000012'$q$, 0);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T7a consented clinician sees the report', (select count(*) from public.patient_reports), 1);
select public.test_expect_fail('T7b consented clinician cannot write reports', $q$insert into public.patient_reports (patient_id, summary) values ('a1000000-0000-0000-0000-000000000001','injected')$q$);
select public.test_expect_rows('T7c consented clinician cannot edit/delete reports', $q$delete from public.patient_reports$q$, 0);
select public.test_expect_fail('T7d clinician cannot grant themselves consent', $q$insert into public.patient_consents (patient_id, grantee_id) values ('a1000000-0000-0000-0000-000000000001', auth.uid())$q$);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000012',false) \gset
select public.test_expect_eq('T7e a different clinician sees 0', (select count(*) from public.patient_reports), 0);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000021',false) \gset
select public.test_expect_eq('T7f hospital admin sees 0 (no consent path)', (select count(*) from public.patient_reports), 0);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_fail('T8a another patient cannot revoke it', $q$select public.revoke_patient_consent((select v from public.test_ids where k='c1'))$q$);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_fail('T8b the grantee cannot revoke it either', $q$select public.revoke_patient_consent((select v from public.test_ids where k='c1'))$q$);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_rows('T8c patient revokes', $q$select public.revoke_patient_consent((select v from public.test_ids where k='c1'))$q$, 1);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T8d after revoke the clinician sees 0 again', (select count(*) from public.patient_reports), 0);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T8e revoking twice errors', $q$select public.revoke_patient_consent((select v from public.test_ids where k='c1'))$q$);
select public.test_expect_rows('T8f patient can re-grant after revoking', $q$insert into public.patient_consents (patient_id, grantee_id) values (auth.uid(),'a1000000-0000-0000-0000-000000000011')$q$, 1);
select set_config('app.current_user_id','a1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T8g re-granted clinician sees it again', (select count(*) from public.patient_reports), 1);
reset role;
