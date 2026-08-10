CREATE TABLE IF NOT EXISTS discovery_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_key text NOT NULL CHECK (field_key IN ('customer_segment','problem','context','current_workaround','desired_outcome','solution','buyer','first_dollar_offer')),
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 4000),
  classification text NOT NULL CHECK (classification IN ('founder_statement','inference','assumption','evidence_observation')),
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
  source_turn_id uuid REFERENCES conversation_turns(id) ON DELETE SET NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance) = 'object'),
  status text NOT NULL DEFAULT 'current' CHECK (status IN ('current','superseded','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discovery_facts_project_field_created_idx ON discovery_facts(project_id, field_key, created_at DESC);
CREATE INDEX IF NOT EXISTS discovery_facts_project_current_idx ON discovery_facts(project_id, status) WHERE status = 'current';
CREATE UNIQUE INDEX IF NOT EXISTS discovery_facts_one_current_per_field_idx ON discovery_facts(project_id, field_key) WHERE status = 'current';

DROP TRIGGER IF EXISTS discovery_facts_updated_at ON discovery_facts;
CREATE TRIGGER discovery_facts_updated_at BEFORE UPDATE ON discovery_facts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
