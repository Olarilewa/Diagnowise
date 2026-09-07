-- =============================================================================
-- Diagnowise — seed.sql
--
-- Synthetic data only (spec §31, §42; doc 2 §17: "the open-source repository
-- must never contain real patient data"). Mirrors the demo cases already
-- built into the frontend prototype (Northbridge General Hospital, Dr. Rao,
-- PT-2291's epigastric pain case) so the two stay conceptually in sync.
--
-- NOTE: this seed assumes the corresponding auth.users rows already exist
-- (created via Supabase Auth sign-up, which is what fires the
-- handle_new_auth_user trigger from 0002). Replace the UUIDs below with real
-- auth.users.id values from your project before running, or run this only
-- against a local/dev Supabase instance seeded with matching test accounts.
-- =============================================================================

insert into public.organizations (id, name, type, country) values
  ('10000000-0000-0000-0000-000000000001', 'Northbridge General Hospital', 'hospital', 'Nigeria')
on conflict (id) do nothing;

-- Assumes these auth.users already exist (see note above).
update public.users set role = 'hospital_admin', organization_id = '10000000-0000-0000-0000-000000000001', name = 'Dr. Advika Rao', specialty = 'Internal Medicine'
  where email = 'admin@northbridge.org';
update public.users set role = 'clinician', organization_id = '10000000-0000-0000-0000-000000000001', name = 'Dr. Advika Rao', specialty = 'Internal Medicine'
  where email = 'rao@northbridge.org';

insert into public.patients (id, organization_id, external_reference, age, sex) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'PT-2291', 48, 'male'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'PT-1187', 34, 'female'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'PT-0564', 61, 'male')
on conflict (organization_id, external_reference) do nothing;

insert into public.cases (
  id, patient_id, clinician_id, status, risk_level, setting, presenting_complaint, working_diagnosis
)
select
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  u.id,
  'active',
  'moderate',
  'Outpatient — Internal Medicine',
  'Recurrent upper abdominal pain for approximately four months, with associated unintentional weight loss and minimal response to prior ulcer-directed treatment.',
  'Peptic ulcer disease'
from public.users u where u.email = 'rao@northbridge.org'
on conflict (id) do nothing;

insert into public.symptoms (case_id, name, onset, duration, severity, source) values
  ('30000000-0000-0000-0000-000000000001', 'Upper abdominal pain', '~4 months ago', 'ongoing', 'moderate', 'patient'),
  ('30000000-0000-0000-0000-000000000001', 'Unintentional weight loss', '3 months', '-6kg', 'moderate', 'clinician');

insert into public.diagnoses (case_id, diagnosis, category, likelihood, reasoning, supporting_evidence, contradicting_evidence, is_ai_generated) values
  ('30000000-0000-0000-0000-000000000001', 'Peptic ulcer disease', 'working', 'moderate',
   'Epigastric pain pattern consistent with prior presumptive diagnosis.',
   '["Epigastric pain pattern", "Prior presumptive diagnosis"]'::jsonb,
   '["No improvement after an adequate PPI trial", "Weight loss atypical for uncomplicated PUD"]'::jsonb,
   true),
  ('30000000-0000-0000-0000-000000000001', 'Gastric malignancy', 'dangerous', 'moderate',
   'Persistent symptoms, weight loss, age, and family history meet common thresholds for expedited endoscopic evaluation.',
   '["Unintentional weight loss", "Persistent symptoms despite treatment", "Family history of gastric cancer"]'::jsonb,
   '["No hematemesis or melena reported", "No palpable mass documented"]'::jsonb,
   true);

insert into public.red_flags (case_id, finding, severity, explanation, relevant_diagnoses) values
  ('30000000-0000-0000-0000-000000000001', 'Unintentional weight loss', 'danger',
   'Unexplained weight loss alongside persistent GI symptoms raises the likelihood of an underlying structural or malignant process.',
   '["Gastric malignancy"]'::jsonb),
  ('30000000-0000-0000-0000-000000000001', 'Persistent symptoms despite treatment', 'danger',
   'Lack of response to an adequate trial of acid suppression makes uncomplicated peptic disease less likely.',
   '["Peptic ulcer disease", "Gastric malignancy"]'::jsonb);

insert into public.investigations (case_id, name, purpose, status) values
  ('30000000-0000-0000-0000-000000000001', 'Upper endoscopy with biopsy', 'To evaluate the current working diagnosis', 'suggested'),
  ('30000000-0000-0000-0000-000000000001', 'H. pylori testing', 'To distinguish between competing diagnoses', 'suggested'),
  ('30000000-0000-0000-0000-000000000001', 'CA 19-9 and serum lipase', 'To evaluate a potentially serious alternative', 'suggested');

insert into public.follow_ups (case_id, due_date, status, expected_response) values
  ('30000000-0000-0000-0000-000000000001', current_date + interval '14 days', 'pending',
   'Symptom improvement and weight stabilization within 2-4 weeks of directed investigation.');

insert into public.case_timeline_events (case_id, event, detail, occurred_at) values
  ('30000000-0000-0000-0000-000000000001', 'Initial presentation', 'Epigastric pain reported; presumptive peptic ulcer disease.', now() - interval '105 days'),
  ('30000000-0000-0000-0000-000000000001', 'Treatment started', 'Omeprazole 20mg daily, 8-week course.', now() - interval '103 days'),
  ('30000000-0000-0000-0000-000000000001', 'Follow-up', 'Minimal symptomatic improvement reported.', now() - interval '50 days'),
  ('30000000-0000-0000-0000-000000000001', 'Persistent symptoms detected', 'Weight loss and continued pain documented at follow-up.', now() - interval '5 days');
