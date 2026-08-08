CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL, name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  short_description text, long_description text, stage text NOT NULL DEFAULT 'idea', status text NOT NULL DEFAULT 'active',
  target_customer text, problem_statement text, solution_summary text, revenue_model text, pricing_hypothesis text,
  validation_stage text, project_memory_summary text, founder_goal text, founder_constraints text, first_dollar_path jsonb NOT NULL DEFAULT '{}'::jsonb,
  primary_industry text CHECK (primary_industry IN ('saas','marketplace','education','local_service','ecommerce','healthcare','other')),
  secondary_industry text CHECK (secondary_industry IN ('saas','marketplace','education','local_service','ecommerce','healthcare','other')),
  industry_confidence text CHECK (industry_confidence IN ('high','medium','low')), industry_rationale text,
  industry_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title text NOT NULL, decision text NOT NULL,
  reason text, status text NOT NULL DEFAULT 'active', decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, statement text NOT NULL,
  category text NOT NULL, subcategory text, status text NOT NULL DEFAULT 'untested' CHECK (status IN ('untested','testing','supported','contradicted','invalidated')),
  priority text NOT NULL DEFAULT 'medium', confidence text NOT NULL DEFAULT 'low', source text NOT NULL DEFAULT 'founder', owner text, importance integer NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  uncertainty integer NOT NULL DEFAULT 3 CHECK (uncertainty BETWEEN 1 AND 5), risk_score integer NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100), revenue_blocker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, source_type text NOT NULL, source_title text NOT NULL,
  summary text NOT NULL, raw_text text, source_date date, source_person_name text, source_company text, strength text NOT NULL DEFAULT 'moderate', confidence text NOT NULL DEFAULT 'medium',
  specificity text, recency text, bias_risk text, willingness_to_pay_signal text, behavior_vs_opinion text NOT NULL DEFAULT 'opinion',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL,
  title text NOT NULL, hypothesis text NOT NULL, test_design text, success_metric text NOT NULL, success_threshold text, status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','running','completed','paused','failed')),
  expected_duration text, owner text, started_at timestamptz, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL,
  assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL, title text NOT NULL, description text, priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done','skipped','blocked')), due_date date, estimated_minutes integer CHECK (estimated_minutes > 0),
  impact_level text, effort_level text, source text NOT NULL DEFAULT 'founder', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS artifacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type text NOT NULL, title text NOT NULL, content text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS assumption_evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assumption_id uuid NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE, evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE, relationship text NOT NULL CHECK (relationship IN ('supports','contradicts','neutral')), explanation text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(assumption_id, evidence_id));
CREATE TABLE IF NOT EXISTS assumption_experiment (assumption_id uuid NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE, experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (assumption_id, experiment_id));
CREATE TABLE IF NOT EXISTS evidence_experiment (evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE, experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (evidence_id, experiment_id));
CREATE TABLE IF NOT EXISTS task_experiment (task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (task_id, experiment_id));
CREATE TABLE IF NOT EXISTS task_assumption (task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, assumption_id uuid NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (task_id, assumption_id));
CREATE TABLE IF NOT EXISTS event_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, actor_type text NOT NULL DEFAULT 'founder', actor_id text, event_type text NOT NULL, entity_type text NOT NULL, entity_id uuid, summary text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DO $$ DECLARE tbl text; BEGIN FOREACH tbl IN ARRAY ARRAY['projects','decisions','assumptions','evidence','experiments','tasks','artifacts'] LOOP EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I', tbl, tbl); EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl, tbl); END LOOP; END $$;
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id); CREATE INDEX IF NOT EXISTS assumptions_project_id_idx ON assumptions(project_id); CREATE INDEX IF NOT EXISTS evidence_project_id_idx ON evidence(project_id); CREATE INDEX IF NOT EXISTS experiments_project_id_idx ON experiments(project_id); CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id); CREATE INDEX IF NOT EXISTS event_log_project_created_idx ON event_log(project_id, created_at DESC);
