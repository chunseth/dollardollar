-- Deterministic planner persistence. The JSON recommendation remains for
-- compatibility; normalized columns make current/history reads explicit.
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS primary_issue_id uuid REFERENCES assumptions(id) ON DELETE SET NULL;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS primary_issue_text text NOT NULL DEFAULT '';
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'wait' CHECK (state IN ('question','task','experiment','wait'));
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS source_context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_context) = 'object');
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES recommendations(id) ON DELETE SET NULL;

-- A replacement points back to the row it supersedes. This supersedes_id
-- back-reference is the intended equivalent of a superseded_by forward link
-- for approved ChangeSets. Together with the partial one-active index below
-- and the project-row lock in recommendations.js, this yields one current row
-- and a readable, linear recommendation history.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_no_self_supersession') THEN
    ALTER TABLE recommendations ADD CONSTRAINT recommendations_no_self_supersession CHECK (supersedes_id IS NULL OR supersedes_id <> id);
  END IF;
END $$;

UPDATE recommendations
SET primary_issue_text = COALESCE(NULLIF(recommendation->>'primary_issue', ''), primary_issue_text),
    state = CASE WHEN recommendation->>'state' IN ('question','task','experiment','wait') THEN recommendation->>'state' ELSE state END,
    source_context = CASE WHEN source_context = '{}'::jsonb THEN jsonb_build_object('context_packet_id', context_packet_id) ELSE source_context END
WHERE primary_issue_text = '' OR source_context = '{}'::jsonb;

-- Existing rows received the column default of 1. Assign deterministic,
-- chronological versions before enforcing project/version uniqueness.
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY created_at ASC, id ASC
    )::integer AS new_version
  FROM recommendations
)
UPDATE recommendations AS r
SET version = numbered.new_version
FROM numbered
WHERE r.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS recommendations_project_version_idx ON recommendations(project_id, version);
CREATE INDEX IF NOT EXISTS recommendations_project_history_idx ON recommendations(project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS recommendations_supersedes_idx ON recommendations(supersedes_id) WHERE supersedes_id IS NOT NULL;
