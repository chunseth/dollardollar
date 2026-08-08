ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_industry text CHECK (primary_industry IN ('saas','marketplace','education','local_service','ecommerce','healthcare','other'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secondary_industry text CHECK (secondary_industry IN ('saas','marketplace','education','local_service','ecommerce','healthcare','other'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industry_confidence text CHECK (industry_confidence IN ('high','medium','low'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industry_rationale text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industry_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS first_dollar_path jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL, title text NOT NULL, description text NOT NULL,
  success_metric text NOT NULL, position integer NOT NULL CHECK (position > 0), status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','active','completed','skipped')),
  source text NOT NULL DEFAULT 'ai', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, position)
);
DROP TRIGGER IF EXISTS roadmap_milestones_updated_at ON roadmap_milestones;
CREATE TRIGGER roadmap_milestones_updated_at BEFORE UPDATE ON roadmap_milestones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS roadmap_milestones_project_position_idx ON roadmap_milestones(project_id, position);
