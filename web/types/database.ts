/**
 * Diagnowise — database types
 *
 * Hand-maintained to match supabase/migrations/0001_init_schema.sql exactly.
 *
 * In a real deployment, replace this file with the output of:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 * and keep it in CI so drift between schema and types is impossible. It's
 * hand-written here only because there's no live Supabase project to
 * generate against in this environment — the shape below is verified by
 * hand against the migration file, not guessed.
 */

export type UserRole = "clinician" | "medical_student" | "hospital_admin" | "researcher";
export type OrganizationType = "hospital" | "clinic" | "academic" | "other";
export type Sex = "male" | "female" | "other" | "unspecified";
export type CaseStatus =
  | "draft"
  | "active"
  | "awaiting_investigation"
  | "awaiting_followup"
  | "reassessment_required"
  | "resolved"
  | "archived";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type EvidenceSource = "patient" | "clinician" | "ai" | "system";
export type DiagnosisCategory = "working" | "differential" | "dangerous";
export type Likelihood = "low" | "moderate" | "high";
export type RedFlagSeverity = "info" | "warning" | "danger" | "critical";
export type InvestigationStatus = "suggested" | "ordered" | "completed";
export type FollowUpStatus = "pending" | "completed" | "overdue";

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  country: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  specialty: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  organization_id: string;
  external_reference: string;
  age: number | null;
  sex: Sex | null;
  created_at: string;
}

export interface Case {
  id: string;
  patient_id: string;
  clinician_id: string;
  organization_id: string;
  status: CaseStatus;
  risk_level: RiskLevel;
  setting: string | null;
  presenting_complaint: string | null;
  working_diagnosis: string | null;
  created_at: string;
  updated_at: string;
}

export interface Symptom {
  id: string;
  case_id: string;
  name: string;
  onset: string | null;
  duration: string | null;
  severity: string | null;
  status: "active" | "resolved";
  source: EvidenceSource;
  created_at: string;
}

export interface Diagnosis {
  id: string;
  case_id: string;
  diagnosis: string;
  category: DiagnosisCategory;
  likelihood: Likelihood | null;
  reasoning: string | null;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  confidence_category: string | null;
  is_ai_generated: boolean;
  created_at: string;
}

export interface RedFlag {
  id: string;
  case_id: string;
  finding: string;
  severity: RedFlagSeverity;
  explanation: string | null;
  relevant_diagnoses: string[];
  created_at: string;
}

export interface Contradiction {
  id: string;
  case_id: string;
  summary: string;
  inconsistencies: string[];
  created_at: string;
}

export interface Investigation {
  id: string;
  case_id: string;
  name: string;
  purpose: string | null;
  status: InvestigationStatus;
  result: string | null;
  date: string | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  case_id: string;
  due_date: string | null;
  status: FollowUpStatus;
  expected_response: string | null;
  outcome: string | null;
  created_at: string;
}

export interface CaseTimelineEvent {
  id: string;
  case_id: string;
  event: string;
  detail: string | null;
  occurred_at: string;
}

export interface AiInteraction {
  id: string;
  case_id: string;
  model: string;
  stage: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/**
 * Minimal but structurally-correct shape of Supabase's generated `Database`
 * type: Row/Insert/Update per table. This is what makes `.from("cases").insert(...)`
 * and `.select("*").single()` infer correctly instead of collapsing to `never` —
 * the generated client's generics specifically key off all three variants
 * being present, not just Row.
 *
 * Insert types make every column with a database default (id, created_at,
 * ...) optional and every nullable column optional; Update types make
 * everything optional. This mirrors supabase gen types' own conventions so
 * swapping this file for a generated one later is a drop-in replacement.
 */
type Nullable<T> = T | null;

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Pick<Organization, "id" | "type" | "country" | "created_at">> & Pick<Organization, "name">;
        Update: Partial<Organization>;
        Relationships: [];
      };
      users: {
        Row: UserProfile;
        Insert: Partial<Pick<UserProfile, "specialty" | "organization_id" | "created_at" | "updated_at">> &
          Pick<UserProfile, "id" | "name" | "email" | "role">;
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      patients: {
        Row: Patient;
        Insert: Partial<Pick<Patient, "id" | "age" | "sex" | "created_at">> &
          Pick<Patient, "organization_id" | "external_reference">;
        Update: Partial<Patient>;
        Relationships: [];
      };
      cases: {
        Row: Case;
        Insert: Partial<
          Pick<Case, "id" | "organization_id" | "status" | "risk_level" | "setting" | "presenting_complaint" | "working_diagnosis" | "created_at" | "updated_at">
        > &
          Pick<Case, "patient_id" | "clinician_id">;
        Update: Partial<Case>;
        Relationships: [];
      };
      symptoms: {
        Row: Symptom;
        Insert: Partial<Pick<Symptom, "id" | "onset" | "duration" | "severity" | "status" | "source" | "created_at">> &
          Pick<Symptom, "case_id" | "name">;
        Update: Partial<Symptom>;
        Relationships: [];
      };
      diagnoses: {
        Row: Diagnosis;
        Insert: Partial<
          Pick<
            Diagnosis,
            "id" | "likelihood" | "reasoning" | "supporting_evidence" | "contradicting_evidence" | "confidence_category" | "is_ai_generated" | "created_at"
          >
        > &
          Pick<Diagnosis, "case_id" | "diagnosis" | "category">;
        Update: Partial<Diagnosis>;
        Relationships: [];
      };
      red_flags: {
        Row: RedFlag;
        Insert: Partial<Pick<RedFlag, "id" | "severity" | "explanation" | "relevant_diagnoses" | "created_at">> &
          Pick<RedFlag, "case_id" | "finding">;
        Update: Partial<RedFlag>;
        Relationships: [];
      };
      contradictions: {
        Row: Contradiction;
        Insert: Partial<Pick<Contradiction, "id" | "inconsistencies" | "created_at">> & Pick<Contradiction, "case_id" | "summary">;
        Update: Partial<Contradiction>;
        Relationships: [];
      };
      investigations: {
        Row: Investigation;
        Insert: Partial<Pick<Investigation, "id" | "purpose" | "status" | "result" | "date" | "created_at">> &
          Pick<Investigation, "case_id" | "name">;
        Update: Partial<Investigation>;
        Relationships: [];
      };
      follow_ups: {
        Row: FollowUp;
        Insert: Partial<Pick<FollowUp, "id" | "due_date" | "status" | "expected_response" | "outcome" | "created_at">> &
          Pick<FollowUp, "case_id">;
        Update: Partial<FollowUp>;
        Relationships: [];
      };
      case_timeline_events: {
        Row: CaseTimelineEvent;
        Insert: Partial<Pick<CaseTimelineEvent, "id" | "detail" | "occurred_at">> & Pick<CaseTimelineEvent, "case_id" | "event">;
        Update: Partial<CaseTimelineEvent>;
        Relationships: [];
      };
      ai_interactions: {
        Row: AiInteraction;
        Insert: Partial<Pick<AiInteraction, "id" | "created_at">> & Pick<AiInteraction, "case_id" | "model" | "stage" | "input" | "output">;
        Update: Partial<AiInteraction>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<Pick<AuditLog, "id" | "entity_id" | "metadata" | "timestamp">> &
          Pick<AuditLog, "user_id" | "action" | "entity">;
        Update: Partial<AuditLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
