CREATE TABLE IF NOT EXISTS beliefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL,
  current_version_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS belief_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id uuid NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  statement text NOT NULL,
  classification text NOT NULL,
  validation_status text NOT NULL,
  confidence text,
  importance integer,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scope) = 'object'),
  rationale text,
  source_event_id uuid REFERENCES event_log(id) ON DELETE SET NULL,
  source_turn_id uuid REFERENCES conversation_turns(id) ON DELETE SET NULL,
  source_user_id text,
  source_assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL,
  source_identifier text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (belief_id, version_number)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beliefs_current_version_id_fkey') THEN
    ALTER TABLE beliefs ADD CONSTRAINT beliefs_current_version_id_fkey
      FOREIGN KEY (current_version_id) REFERENCES belief_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS belief_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_version_id uuid NOT NULL REFERENCES belief_versions(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('supports','contradicts','mixed','neutral')),
  explanation text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (belief_version_id, evidence_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS beliefs_origin_assumption_id_unique_idx ON beliefs(origin_assumption_id) WHERE origin_assumption_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS beliefs_project_active_idx ON beliefs(project_id, created_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS belief_versions_belief_version_idx ON belief_versions(belief_id, version_number DESC);
CREATE INDEX IF NOT EXISTS belief_evidence_links_version_idx ON belief_evidence_links(belief_version_id);
CREATE INDEX IF NOT EXISTS belief_evidence_links_evidence_idx ON belief_evidence_links(evidence_id);

-- Project pre-existing assumptions into the versioned model when this migration
-- is applied to an existing database. New assumptions are projected by the API.
INSERT INTO beliefs (project_id, origin_assumption_id)
SELECT a.project_id, a.id
FROM assumptions a
WHERE NOT EXISTS (
  SELECT 1 FROM beliefs b WHERE b.origin_assumption_id = a.id
);

INSERT INTO belief_versions (
  belief_id, version_number, statement, classification, validation_status,
  confidence, importance, source_assumption_id, source_identifier, provenance
)
SELECT b.id, 1, a.statement, a.category, a.status,
       a.confidence, a.importance, a.id, 'migration_004',
       '{"migration":"004_versioned_beliefs"}'::jsonb
FROM beliefs b
JOIN assumptions a ON a.id = b.origin_assumption_id
WHERE NOT EXISTS (
  SELECT 1 FROM belief_versions bv WHERE bv.belief_id = b.id
);

UPDATE beliefs b
SET current_version_id = bv.id
FROM belief_versions bv
WHERE bv.belief_id = b.id
  AND bv.version_number = 1
  AND b.current_version_id IS NULL;
