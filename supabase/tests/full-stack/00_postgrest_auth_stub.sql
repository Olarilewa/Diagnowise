-- LOCAL TEST HARNESS ONLY — for genuine end-to-end testing against a real
-- PostgREST instance (matching how Supabase itself is architected), rather
-- than the simpler session-variable stub in 00_local_auth_stub.sql (which
-- is enough for pure-SQL RLS testing but doesn't exercise the real
-- @supabase/supabase-js client or real JWT verification).

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- The actual Supabase implementation: reads the "sub" claim PostgREST
-- exposes as a Postgres GUC once it verifies a request's JWT.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'authenticator';
  end if;
end
$$;

grant anon to authenticator;
grant authenticated to authenticator;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, anon;
