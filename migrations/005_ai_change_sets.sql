-- Phase 5: AI proposals are persisted for founder review before any memory write.
-- The composite key makes an AI proposal's turn belong to the same project at
-- the database boundary, not merely in application code.
CREATE UNIQUE INDEX IF NOT EXISTS conversation_turns_id_project_id_unique_idx ON conversation_turns(id, project_id);
CREATE TABLE IF NOT EXISTS change_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_turn_id uuid,
  origin text NOT NULL CHECK (origin IN ('ai','founder','system')),
  rationale text,
  proposal_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(proposal_metadata) = 'object'),
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','partially_approved','approved','rejected','applying','applied','failed','expired')),
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  rejection_reason text,
  applied_at timestamptz,
  applied_by text,
  application_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(application_metadata) = 'object'),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_change_sets_require_source_turn CHECK (origin <> 'ai' OR source_turn_id IS NOT NULL),
  CONSTRAINT change_sets_source_turn_project_fkey FOREIGN KEY (source_turn_id, project_id) REFERENCES conversation_turns(id, project_id) ON DELETE RESTRICT,
  UNIQUE (project_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS change_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id uuid NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  record_type text NOT NULL CHECK (record_type IN ('belief','evidence','task','experiment','decision','recommendation')),
  operation text NOT NULL CHECK (operation IN ('create','update','link')),
  target_entity_id uuid,
  original_payload jsonb NOT NULL CHECK (jsonb_typeof(original_payload) = 'object'),
  current_payload jsonb NOT NULL CHECK (jsonb_typeof(current_payload) = 'object'),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected','applied')),
  validation_status text NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid','invalid')),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(validation_errors) = 'array'),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text,
  revision_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(revision_metadata) = 'object'),
  application_result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(application_result_metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (change_set_id, sequence_number),
  CONSTRAINT change_set_item_operation_target CHECK (
    (operation = 'create' AND target_entity_id IS NULL) OR
    (operation IN ('update','link') AND target_entity_id IS NOT NULL)
  )
);

-- Keep already-created databases aligned when the recommendation item is added
-- after the initial Phase 5 deployment.
ALTER TABLE change_set_items DROP CONSTRAINT IF EXISTS change_set_items_record_type_check;
ALTER TABLE change_set_items ADD CONSTRAINT change_set_items_record_type_check CHECK (record_type IN ('belief','evidence','task','experiment','decision','recommendation'));

DROP TRIGGER IF EXISTS change_sets_updated_at ON change_sets;
CREATE TRIGGER change_sets_updated_at BEFORE UPDATE ON change_sets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS change_set_items_updated_at ON change_set_items;
CREATE TRIGGER change_set_items_updated_at BEFORE UPDATE ON change_set_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS change_sets_project_pending_review_idx
  ON change_sets(project_id, created_at DESC) WHERE status IN ('pending_review','partially_approved','approved');
CREATE INDEX IF NOT EXISTS change_sets_project_lifecycle_idx ON change_sets(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS change_set_items_change_set_review_idx ON change_set_items(change_set_id, review_status, sequence_number);
