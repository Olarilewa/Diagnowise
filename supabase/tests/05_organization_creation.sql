-- Verifies 0009. Run on a clean database after the full chain (00 stub, 0001-0009).
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

insert into public.organizations (id, name) values ('00000000-0000-0000-0000-0000000000a1','Pre-existing hospital');
insert into auth.users (id, email, raw_user_meta_data) values
 ('a5000000-0000-0000-0000-000000000001','clin@x.org','{"name":"Dr New"}'),
 ('a5000000-0000-0000-0000-000000000002','admin@x.org','{"name":"New Admin"}'),
 ('a5000000-0000-0000-0000-000000000003','pat@x.org','{"account_type":"patient","name":"A Patient"}'),
 ('a5000000-0000-0000-0000-000000000004','other@x.org','{"name":"Dr Other"}'),
 ('a5000000-0000-0000-0000-000000000005','bad@x.org','{"name":"Dr Bad"}');
update public.users set organization_id='00000000-0000-0000-0000-0000000000a1' where id='a5000000-0000-0000-0000-000000000004';
do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if; end $$;
grant usage on schema public to app_user; grant select,insert,update,delete on all tables in schema public to app_user; grant execute on all functions in schema public to app_user;
grant usage on schema auth to app_user; grant execute on function auth.uid() to app_user;
select public.test_expect_eq('T0 pre-existing organizations are still valid (care_scope NULL)', (select count(*) from public.organizations where care_scope is null), 1);

set role app_user;
-- the v1 path, now closed
select set_config('app.current_user_id','a5000000-0000-0000-0000-000000000001',false) \gset
select public.test_expect_fail('T1 direct organization INSERT is closed', $q$insert into public.organizations (name) values ('Sneaky')$q$);

-- a clinician sets up their hospital
select public.create_organization('Northbridge General Hospital', 'hospital', ' Nigeria ', 'general');
select public.test_expect_eq('T2a the user is attached to the new organization', (select count(*) from public.users where id = auth.uid() and organization_id is not null), 1);
select public.test_expect_text('T2b a clinician stays a clinician', (select role from public.users where id = auth.uid()), 'clinician');
select public.test_expect_text('T2c the new member can now READ their organization (the v1 bug)', (select name from public.organizations), 'Northbridge General Hospital');
select public.test_expect_text('T2d country is trimmed', (select country from public.organizations), 'Nigeria');
select public.test_expect_fail('T2e creating a second organization is refused', $q$select public.create_organization('Another Hospital')$q$);
select public.test_expect_fail('T2f ...and their role is locked now (0006 trigger)', $q$update public.users set role='hospital_admin' where id = auth.uid()$q$);

-- hospital sign-up
select set_config('app.current_user_id','a5000000-0000-0000-0000-000000000002',false) \gset
select public.create_organization('Lagos Eye Centre', 'clinic', 'Nigeria', 'specialist', 'Ophthalmology', 'hospital_admin');
select public.test_expect_text('T3a a hospital sign-up becomes hospital_admin', (select role from public.users where id = auth.uid()), 'hospital_admin');
select public.test_expect_text('T3b the facility scope and detail are stored', (select care_scope || '/' || care_scope_detail from public.organizations), 'specialist/Ophthalmology');
select public.test_expect_rows('T3c the admin can edit their own organization (0003 policy)', $q$update public.organizations set country='Ghana'$q$, 1);
select public.test_expect_eq('T3d ...and sees only their own organization', (select count(*) from public.organizations), 1);

-- who is refused
select set_config('app.current_user_id','a5000000-0000-0000-0000-000000000003',false) \gset
select public.test_expect_fail('T4a a patient cannot create an organization', $q$select public.create_organization('Patient Hospital')$q$);
select set_config('app.current_user_id','a5000000-0000-0000-0000-000000000004',false) \gset
select public.test_expect_fail('T4b someone already in an organization cannot create another', $q$select public.create_organization('Second Org')$q$);
select set_config('app.current_user_id','',false) \gset
select public.test_expect_fail('T4c anonymous cannot create one', $q$select public.create_organization('Ghost')$q$);

-- validation
select set_config('app.current_user_id','a5000000-0000-0000-0000-000000000005',false) \gset
select public.test_expect_fail('T5a a one-character name is refused', $q$select public.create_organization('X')$q$);
select public.test_expect_fail('T5b an over-long name is refused', $q$select public.create_organization(repeat('x', 201))$q$);
select public.test_expect_fail('T5c an unknown facility type is refused', $q$select public.create_organization('Valid Name', 'spaceship')$q$);
select public.test_expect_fail('T5d an unknown care scope is refused', $q$select public.create_organization('Valid Name', 'hospital', null, 'everything')$q$);
select public.test_expect_fail('T5e specialist without a detail is refused', $q$select public.create_organization('Valid Name', 'hospital', null, 'specialist')$q$);
select public.test_expect_fail('T5f other without a detail is refused', $q$select public.create_organization('Valid Name', 'hospital', null, 'other', '   ')$q$);
select public.test_expect_fail('T5g a patient role cannot be requested', $q$select public.create_organization('Valid Name', 'hospital', null, null, null, 'patient')$q$);
select public.test_expect_fail('T5h a researcher role is not offered here either', $q$select public.create_organization('Valid Name', 'hospital', null, null, null, 'researcher')$q$);
select public.test_expect_eq('T5i none of the failed attempts left a partial organization behind', (select count(*) from public.users where id = auth.uid() and organization_id is not null), 0);
reset role;
select public.test_expect_eq('T6 exactly two new organizations exist (plus the pre-existing one)', (select count(*) from public.organizations), 3);
