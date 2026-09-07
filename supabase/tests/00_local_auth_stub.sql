-- LOCAL TEST HARNESS ONLY — not part of the shipped migrations.
-- Stubs the pieces of Supabase's built-in `auth` schema that our real
-- migrations depend on (auth.users, auth.uid()), so the actual migration
-- files can be validated against a real Postgres engine without a live
-- Supabase project. In production, Supabase provides all of this natively.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase's auth.uid() reads the JWT claim of the current request. Locally
-- we simulate "the current request" with a settable session variable so
-- policy tests can switch identity between statements.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;
