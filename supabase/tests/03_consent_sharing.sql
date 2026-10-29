-- Verifies 0007. Run on a clean database after the full chain (00 stub, 0001-0007).
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
create table public.test_codes (k text primary key, code text, expires timestamptz);

insert into auth.users (id, email, raw_user_meta_data) values
 ('e1000000-0000-0000-0000-000000000001','p1@x.org','{"account_type":"patient","name":"Pat One"}'),
 ('e1000000-0000-0000-0000-000000000002','p2@x.org','{"account_type":"patient","name":"Pat Two"}'),
 ('e1000000-0000-0000-0000-000000000011','c1@x.org','{"name":"Dr One"}'),
 ('e1000000-0000-0000-0000-000000000012','c2@x.org','{"name":"Dr Two"}'),
 ('e1000000-0000-0000-0000-000000000021','adm@x.org','{"name":"Admin"}');
update public.users set role='hospital_admin' where id='e1000000-0000-0000-0000-000000000021';
do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if; end $$;
grant usage on schema public to app_user; grant select,insert,update,delete on all tables in schema public to app_user; grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user; grant execute on function auth.uid() to app_user;

set role app_user;
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T1 a patient cannot create a sharing code', $q$select * from public.create_share_code()$q$);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000011',false) \gset
insert into public.test_codes select 'c1', share_code, valid_until from public.create_share_code();
select public.test_expect_eq('T2a code looks like XXXXX-XXXXX', (select length(code) from public.test_codes where k='c1'), 11);
select public.test_expect_eq('T2b valid for about 7 days', (select (expires > now() + interval '6 days' and expires < now() + interval '8 days')::int from public.test_codes where k='c1'), 1);
reset role;
select public.test_expect_eq('T3 only a hash is stored, never the code', (select count(*) from public.clinician_share_codes where code_hash = sha256(convert_to(replace((select code from public.test_codes where k='c1'),'-',''),'UTF8'))), 1);
set role app_user;

-- patient 1 enters the code with sloppy formatting (lowercase, spaces)
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_text('T4 sloppy-formatted code is accepted', (select status from public.grant_consent_by_code((select ' ' || lower(replace(code,'-',' ')) || ' ' from public.test_codes where k='c1'))), 'ok');
insert into public.patient_reports (patient_id, summary, severity, details) values (auth.uid(), 'stomach pain for four months', 'moderate', '{"urgency":"urgent"}');
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T5a the clinician now sees the shared report', (select count(*) from public.shared_reports()), 1);
select public.test_expect_text('T5b ...with the patient''s display name', (select patient_name from public.shared_reports() limit 1), 'Pat One');
select public.test_expect_text('T5c ...and the urgency tier it was given', (select urgency from public.shared_reports() limit 1), 'urgent');
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000012',false) \gset
select public.test_expect_eq('T5d a different clinician sees nothing', (select count(*) from public.shared_reports()), 0);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000021',false) \gset
select public.test_expect_eq('T5e a hospital admin sees nothing', (select count(*) from public.shared_reports()), 0);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_eq('T5f an unrelated patient sees nothing', (select count(*) from public.shared_reports()), 0);

-- rate limiting
select count(*) from generate_series(1,10) g cross join lateral public.grant_consent_by_code('BAD' || g) x;
reset role;
select public.test_expect_eq('T6a ten failed attempts were recorded', (select count(*) from public.consent_code_attempts where patient_id='e1000000-0000-0000-0000-000000000002'), 10);
set role app_user;
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_text('T6b the 11th attempt is blocked EVEN WITH A VALID CODE', (select status from public.grant_consent_by_code((select code from public.test_codes where k='c1'))), 'rate_limited');
reset role; delete from public.consent_code_attempts; set role app_user;

-- regenerating replaces the old code
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000011',false) \gset
insert into public.test_codes select 'c1b', share_code, valid_until from public.create_share_code();
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000002',false) \gset
select public.test_expect_text('T7a the old code stops working', (select status from public.grant_consent_by_code((select code from public.test_codes where k='c1'))), 'invalid');
select public.test_expect_text('T7b the new code works', (select status from public.grant_consent_by_code((select code from public.test_codes where k='c1b'))), 'ok');

-- expiry
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000012',false) \gset
insert into public.test_codes select 'c2', share_code, valid_until from public.create_share_code();
reset role; update public.clinician_share_codes set expires_at = now() - interval '1 minute' where clinician_id='e1000000-0000-0000-0000-000000000012'; set role app_user;
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_text('T8 an expired code is rejected', (select status from public.grant_consent_by_code((select code from public.test_codes where k='c2'))), 'invalid');

-- already shared: no duplicate, and the clinician name is returned for confirmation
select public.test_expect_text('T9a re-sharing reports already_shared', (select status from public.grant_consent_by_code((select code from public.test_codes where k='c1b'))), 'already_shared');
select public.test_expect_text('T9b ...and names the clinician', (select clinician_name from public.grant_consent_by_code((select code from public.test_codes where k='c1b'))), 'Dr One');
reset role;
select public.test_expect_eq('T9c no duplicate active consent was created', (select count(*) from public.patient_consents where patient_id='e1000000-0000-0000-0000-000000000001' and revoked_at is null), 1);
set role app_user;

-- the code tables are closed to every client
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_eq('T10a a patient reads 0 rows of the code table (RLS, no policy)', (select count(*) from public.clinician_share_codes), 0);
select public.test_expect_fail('T10b a patient cannot write attempts', $q$insert into public.consent_code_attempts (patient_id) values (auth.uid())$q$);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_fail('T10c a clinician cannot write their own code row directly', $q$insert into public.clinician_share_codes (clinician_id, code_hash, expires_at) values (auth.uid(), '\x00'::bytea, now() + interval '1 year')$q$);
select public.test_expect_fail('T11 a clinician cannot use the patient-only grant function', $q$select * from public.grant_consent_by_code('ABCDE-FGHIJ')$q$);

-- patient-side listing and revoke
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000002',false) \gset
insert into public.patient_reports (patient_id, summary, details) values (auth.uid(), 'second patient report', '{"urgency":"soon"}');
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_text('T12a my_consents names the clinician', (select clinician_name from public.my_consents() limit 1), 'Dr One');
select public.test_expect_eq('T12b a patient sees only their own consents', (select count(*) from public.my_consents()), 1);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T13 the clinician sees both patients'' reports', (select count(*) from public.shared_reports()), 2);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000001',false) \gset
select public.revoke_patient_consent((select consent_id from public.my_consents() where revoked_at is null limit 1));
select public.test_expect_eq('T14a revoked consent shows revoked_at', (select count(*) from public.my_consents() where revoked_at is not null), 1);
select set_config('app.current_user_id','e1000000-0000-0000-0000-000000000011',false) \gset
select public.test_expect_eq('T14b after revoke the clinician sees only the other patient', (select count(*) from public.shared_reports()), 1);

-- no identity at all
select set_config('app.current_user_id','',false) \gset
select public.test_expect_fail('T15a anonymous cannot create a code', $q$select * from public.create_share_code()$q$);
select public.test_expect_eq('T15b anonymous sees no shared reports', (select count(*) from public.shared_reports()), 0);
reset role;
select public.test_expect_eq('T16 shared_reports exposes no email column', (select (pg_get_function_result('public.shared_reports()'::regprocedure) like '%email%')::int), 0);
