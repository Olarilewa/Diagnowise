-- =============================================================================
-- Diagnowise — 0001_init_schema.sql
--
-- Core multi-tenant data model. Matches section 30 (DATA MODEL) of the master
-- build prompt, with two deliberate additions beyond the literal spec list —
-- called out below — because they back features that are core to the product
-- (diagnostic contradiction detection, case timeline) and have nowhere else
-- to live without overloading unrelated tables:
--
--   * contradictions        — backs the Diagnostic Contradiction Engine (spec §17)
--   * case_timeline_events  — backs the Case History timeline (spec §22)
--
-- Everything else maps 1:1 onto the spec's entity list. Extra columns beyond
-- the literal spec (timestamps, status/risk enums, organization_id denormalized
-- onto `cases` for RLS performance) are the minimum needed for this to be a
-- real, working system rather than a literal transcription of the prompt.
--
-- Run this against a Supabase project's SQL editor / CLI, in order, before
-- 0002_rls_policies.sql and 0003_functions_triggers.sql.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null default 'hospital'
               check (type in ('hospital', 'clinic', 'academic', 'other')),
  country      text,
  created_at   timestamptz not null default now()
);

comment on table public.organizations is
  'A tenant boundary. Every patient, case, and user (other than researchers, '
  'see note on public.users) belongs to exactly one organization. All '
  'multi-tenant isolation in 0002_rls_policies.sql is keyed off this table.';

-- -----------------------------------------------------------------------------
-- users
--
-- Extends Supabase's auth.users (1:1, same primary key) with the
-- product-specific profile fields from spec §30. Row is created by a trigger
-- on auth.users insert — see 0003_functions_triggers.sql.
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null,
  email            text not null unique,
  role             text not null
                   check (role in ('clinician', 'medical_student', 'hospital_admin', 'researcher')),
  specialty        text,
  organization_id  uuid references public.organizations (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.users is
  'Product-facing profile for an authenticated person, 1:1 with auth.users. '
  'organization_id is nullable only because a researcher account is not '
  'required to belong to a hospital organization (spec doc 2, §02-C).';

-- -----------------------------------------------------------------------------
-- patients
--
-- Deliberately minimal per spec §30 ("Avoid unnecessary PII") and §31
-- ("Never expose sensitive clinical information unnecessarily"). No name,
-- date of birth, address, or contact info — a clinician-assigned reference
-- code (e.g. "PT-2291", matching the prototype's convention) plus the two
-- demographic fields the clinical reasoning engine actually needs.
-- -----------------------------------------------------------------------------
create table if not exists public.patients (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  external_reference  text not null,
  age                 int  check (age between 0 and 130),
  sex                 text check (sex in ('male', 'female', 'other', 'unspecified')),
  created_at          timestamptz not null default now(),

  unique (organization_id, external_reference)
);

-- -----------------------------------------------------------------------------
-- cases
-- -----------------------------------------------------------------------------
create table if not exists public.cases (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients (id) on delete cascade,
  clinician_id          uuid not null references public.users (id),
  -- Denormalized from patients.organization_id. Kept in sync by a trigger
  -- (0003) rather than joined at query time in every RLS policy — cases is
  -- the hottest table in the schema and every policy on every child table
  -- ultimately checks this column.
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  status                text not null default 'draft'
                        check (status in (
                          'draft', 'active', 'awaiting_investigation', 'awaiting_followup',
                          'reassessment_required', 'resolved', 'archived'
                        )),
  risk_level            text not null default 'low'
                        check (risk_level in ('low', 'moderate', 'high', 'critical')),
  setting               text,
  presenting_complaint  text,
  working_diagnosis     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists cases_organization_id_idx on public.cases (organization_id);
create index if not exists cases_clinician_id_idx on public.cases (clinician_id);
create index if not exists cases_patient_id_idx on public.cases (patient_id);
create index if not exists cases_status_idx on public.cases (status);

-- -----------------------------------------------------------------------------
-- symptoms
-- -----------------------------------------------------------------------------
create table if not exists public.symptoms (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  name        text not null,
  onset       text,
  duration    text,
  severity    text,
  status      text not null default 'active' check (status in ('active', 'resolved')),
  -- Trust-model field (spec §45): every clinical fact is attributable.
  source      text not null default 'clinician'
              check (source in ('patient', 'clinician', 'ai', 'system')),
  created_at  timestamptz not null default now()
);

create index if not exists symptoms_case_id_idx on public.symptoms (case_id);

-- -----------------------------------------------------------------------------
-- diagnoses
--
-- One row per differential-diagnosis entry (spec calls this "diagnoses" but
-- it is the Differential Diagnosis list from the Diagnostic Workspace — a
-- case's working diagnosis is just the row where category = 'working').
-- Evidence lists are jsonb rather than child tables: they are small,
-- read/written as a unit, and never queried independently — normalizing them
-- would be over-engineering for what they're used for (spec doc 2, §31).
-- -----------------------------------------------------------------------------
create table if not exists public.diagnoses (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references public.cases (id) on delete cascade,
  diagnosis              text not null,
  category               text not null default 'differential'
                         check (category in ('working', 'differential', 'dangerous')),
  likelihood             text check (likelihood in ('low', 'moderate', 'high')),
  reasoning              text,
  supporting_evidence    jsonb not null default '[]'::jsonb,
  contradicting_evidence jsonb not null default '[]'::jsonb,
  confidence_category    text,
  is_ai_generated        boolean not null default true,
  created_at             timestamptz not null default now()
);

create index if not exists diagnoses_case_id_idx on public.diagnoses (case_id);

-- -----------------------------------------------------------------------------
-- red_flags
-- -----------------------------------------------------------------------------
create table if not exists public.red_flags (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases (id) on delete cascade,
  finding             text not null,
  severity            text not null default 'warning'
                      check (severity in ('info', 'warning', 'danger', 'critical')),
  explanation         text,
  relevant_diagnoses  jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists red_flags_case_id_idx on public.red_flags (case_id);

-- -----------------------------------------------------------------------------
-- contradictions  [addition beyond spec §30's literal table list — see header]
-- -----------------------------------------------------------------------------
create table if not exists public.contradictions (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references public.cases (id) on delete cascade,
  summary          text not null,
  inconsistencies  jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists contradictions_case_id_idx on public.contradictions (case_id);

-- -----------------------------------------------------------------------------
-- investigations
-- -----------------------------------------------------------------------------
create table if not exists public.investigations (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  name        text not null,
  -- Organized by purpose, not just listed (spec §20).
  purpose     text,
  status      text not null default 'suggested'
              check (status in ('suggested', 'ordered', 'completed')),
  result      text,
  date        date,
  created_at  timestamptz not null default now()
);

create index if not exists investigations_case_id_idx on public.investigations (case_id);

-- -----------------------------------------------------------------------------
-- follow_ups
-- -----------------------------------------------------------------------------
create table if not exists public.follow_ups (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references public.cases (id) on delete cascade,
  due_date           date,
  status             text not null default 'pending'
                     check (status in ('pending', 'completed', 'overdue')),
  expected_response  text,
  outcome            text,
  created_at         timestamptz not null default now()
);

create index if not exists follow_ups_case_id_idx on public.follow_ups (case_id);
create index if not exists follow_ups_status_idx on public.follow_ups (status);

-- -----------------------------------------------------------------------------
-- case_timeline_events  [addition beyond spec §30's literal table list — see header]
-- -----------------------------------------------------------------------------
create table if not exists public.case_timeline_events (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  event        text not null,
  detail       text,
  occurred_at  timestamptz not null default now()
);

create index if not exists case_timeline_events_case_id_idx on public.case_timeline_events (case_id);

-- -----------------------------------------------------------------------------
-- ai_interactions
--
-- One row per call into the AI orchestration layer (phase 2). `stage` maps
-- onto the 10-stage pipeline from spec §27 (e.g. 'differential_generation',
-- 'red_flag_detection'). This table is the audit trail that makes AI output
-- distinguishable from clinician-confirmed information (spec §28, §45).
-- -----------------------------------------------------------------------------
create table if not exists public.ai_interactions (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  model       text not null,
  stage       text not null,
  input       jsonb not null default '{}'::jsonb,
  output      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ai_interactions_case_id_idx on public.ai_interactions (case_id);

-- -----------------------------------------------------------------------------
-- audit_logs
--
-- Append-only. Never updated, never deleted by application code (spec §31).
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  "timestamp" timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
