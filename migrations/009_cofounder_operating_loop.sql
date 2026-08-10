-- Cofounder operating loop: durable response planning, async enrichment,
-- provenance-backed memory, topic sessions, and a dependency-aware roadmap.

ALTER TABLE conversation_sessions
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS checkpoint_status text NOT NULL DEFAULT 'not_ready'
    CHECK (checkpoint_status IN ('not_ready','ready','naming','snapshot_pending','confirmed')),
  ADD COLUMN IF NOT EXISTS checkpoint_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(checkpoint_metadata) = 'object');

CREATE TABLE IF NOT EXISTS cofounder_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  version integer NOT NULL CHECK (version > 0),
  mode text NOT NULL DEFAULT 'explorer',
  source_turn_id uuid REFERENCES conversation_turns(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS cofounder_plans_one_active_idx
  ON cofounder_plans(project_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS cofounder_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES cofounder_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  intent text NOT NULL,
  response_type text NOT NULL CHECK (response_type IN ('question','reflect','challenge','checkpoint','action','wait')),
  prompt text NOT NULL,
  aspects jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(aspects) = 'array'),
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(trigger) = 'object'),
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_ids) = 'array'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','consumed','skipped','expired')),
  consumed_by_turn_id uuid REFERENCES conversation_turns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS cofounder_plan_items_pending_idx
  ON cofounder_plan_items(project_id, status, plan_id, sequence_number);

CREATE TABLE IF NOT EXISTS background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, job_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS background_jobs_claim_idx
  ON background_jobs(status, available_at, created_at)
  WHERE status IN ('queued','running');

DROP TRIGGER IF EXISTS background_jobs_updated_at ON background_jobs;
CREATE TRIGGER background_jobs_updated_at BEFORE UPDATE ON background_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  aspect text NOT NULL CHECK (aspect IN ('customer','problem','context','workaround','solution','buyer','pricing','feasibility','distribution','product','technical','goal','constraint','brand')),
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 4000),
  value jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(value) = 'object'),
  classification text NOT NULL CHECK (classification IN ('founder_statement','inference','assumption','evidence_observation','decision','constraint')),
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
  evidence_status text NOT NULL DEFAULT 'unverified' CHECK (evidence_status IN ('unverified','partial','supported','contradicted','mixed')),
  review_state text NOT NULL DEFAULT 'working' CHECK (review_state IN ('working','confirmed','rejected','pending_review')),
  source_turn_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_turn_ids) = 'array'),
  source_document_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_document_ids) = 'array'),
  related_entity_ids jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(related_entity_ids) = 'object'),
  status text NOT NULL DEFAULT 'current' CHECK (status IN ('current','superseded','rejected')),
  supersedes_id uuid REFERENCES memory_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_items_project_aspect_idx
  ON memory_items(project_id, aspect, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_items_project_review_idx
  ON memory_items(project_id, review_state, status);

DROP TRIGGER IF EXISTS memory_items_updated_at ON memory_items;
CREATE TRIGGER memory_items_updated_at BEFORE UPDATE ON memory_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS roadmap_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('milestone','assumption','experiment','task','evidence','build')),
  entity_id uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked','completed','skipped')),
  visible boolean NOT NULL DEFAULT false,
  position integer,
  source text NOT NULL DEFAULT 'ai',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roadmap_nodes_project_type_entity_idx
  ON roadmap_nodes(project_id, node_type, entity_id);

CREATE TABLE IF NOT EXISTS roadmap_edges (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'depends_on' CHECK (relation IN ('depends_on','supports','unblocks')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_node_id, to_node_id),
  CHECK (from_node_id <> to_node_id)
);

CREATE INDEX IF NOT EXISTS roadmap_nodes_project_visible_idx
  ON roadmap_nodes(project_id, visible, position);
CREATE INDEX IF NOT EXISTS roadmap_edges_project_idx
  ON roadmap_edges(project_id);

-- Existing discovery facts are immediately visible in the canonical memory
-- workspace while retaining their original source and lifecycle.
INSERT INTO memory_items (
  project_id, aspect, statement, classification, confidence, review_state,
  source_turn_ids, related_entity_ids, created_at, updated_at
)
SELECT
  project_id,
  CASE field_key
    WHEN 'customer_segment' THEN 'customer'
    WHEN 'current_workaround' THEN 'workaround'
    WHEN 'desired_outcome' THEN 'goal'
    WHEN 'first_dollar_offer' THEN 'pricing'
    ELSE field_key
  END,
  statement,
  classification,
  confidence,
  CASE WHEN classification = 'founder_statement' THEN 'confirmed' ELSE 'working' END,
  CASE WHEN source_turn_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(source_turn_id::text) END,
  jsonb_build_object('discovery_fact_id', id::text),
  created_at,
  updated_at
FROM discovery_facts
WHERE status = 'current'
  AND NOT EXISTS (
    SELECT 1 FROM memory_items item
    WHERE item.project_id = discovery_facts.project_id
      AND item.related_entity_ids->>'discovery_fact_id' = discovery_facts.id::text
  );
