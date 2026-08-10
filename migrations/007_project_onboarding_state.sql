ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS onboarding_state text NOT NULL DEFAULT 'active'
  CHECK (onboarding_state IN ('discovery', 'active'));

COMMENT ON COLUMN projects.onboarding_state IS 'Controls whether a founder is still in the cofounder discovery phase or has reached the first checkpoint.';
