-- LOCAL TEST HARNESS ONLY. Proves the RLS policies in 0003 actually isolate
-- data correctly, using a non-superuser role (RLS is bypassed for superusers
-- and table owners, so testing as `diagnowise` — the owner — would prove
-- nothing; we need a genuinely restricted role).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end
$$;
grant usage on schema public to app_user;
grant select, insert, update on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;

-- --- Seed: two hospitals, each with an admin and a clinician ---------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@northbridge.org'),
  ('a0000000-0000-0000-0000-000000000002', 'rao@northbridge.org'),
  ('a0000000-0000-0000-0000-000000000003', 'chen@riverside.org');

insert into public.organizations (id, name, type, country) values
  ('00000000-0000-0000-0000-00000000000a', 'Northbridge General Hospital', 'hospital', 'Nigeria'),
  ('00000000-0000-0000-0000-00000000000b', 'Riverside Clinic', 'clinic', 'Kenya');

update public.users set role = 'hospital_admin', organization_id = '00000000-0000-0000-0000-00000000000a'
  where id = 'a0000000-0000-0000-0000-000000000001';
update public.users set role = 'clinician', organization_id = '00000000-0000-0000-0000-00000000000a'
  where id = 'a0000000-0000-0000-0000-000000000002';
update public.users set role = 'clinician', organization_id = '00000000-0000-0000-0000-00000000000b'
  where id = 'a0000000-0000-0000-0000-000000000003';

insert into public.patients (id, organization_id, external_reference, age, sex) values
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'PT-2291', 48, 'male'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'PT-9001', 34, 'female');

insert into public.cases (id, patient_id, clinician_id, status, risk_level, presenting_complaint) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000002', 'active', 'high', 'Epigastric pain, 4 months'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000003', 'active', 'moderate', 'Persistent cough, 9 weeks');

insert into public.red_flags (case_id, finding, severity, explanation) values
  ('c0000000-0000-0000-0000-000000000001', 'Unintentional weight loss', 'danger', 'Test red flag');

\echo '--- TEST 1: Dr. Rao (clinician, Northbridge) should see exactly her own case ---'
set role app_user;
set app.current_user_id = 'a0000000-0000-0000-0000-000000000002';
select id, presenting_complaint from public.cases;

\echo '--- TEST 2: Dr. Rao should NOT be able to see Riverside patients ---'
select count(*) as riverside_patients_visible_to_rao from public.patients
  where organization_id = '00000000-0000-0000-0000-00000000000b';

\echo '--- TEST 3: Northbridge admin should see ALL Northbridge cases (org-wide), including ones not assigned to them ---'
reset role;
set role app_user;
set app.current_user_id = 'a0000000-0000-0000-0000-000000000001';
select id, presenting_complaint from public.cases;

\echo '--- TEST 4: Northbridge admin should still NOT see Riverside cases ---'
select count(*) as riverside_cases_visible_to_northbridge_admin from public.cases
  where id = 'c0000000-0000-0000-0000-000000000002';

\echo '--- TEST 5: Dr. Chen (Riverside) should see only her own case, and the red flag on Rao''s case should be invisible to her ---'
reset role;
set role app_user;
set app.current_user_id = 'a0000000-0000-0000-0000-000000000003';
select id, presenting_complaint from public.cases;
select count(*) as northbridge_red_flags_visible_to_chen from public.red_flags
  where case_id = 'c0000000-0000-0000-0000-000000000001';

\echo '--- TEST 6: with no identity set at all (anon), nothing should be visible ---'
reset role;
set role app_user;
reset app.current_user_id;
select count(*) as cases_visible_to_anon from public.cases;

reset role;
