CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  initiated_by text NOT NULL DEFAULT 'founder' CHECK (initiated_by IN ('founder', 'ai', 'system')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS context_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'chat_turn',
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  included_memory_record_ids jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(included_memory_record_ids) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  context_packet_id uuid REFERENCES context_packets(id) ON DELETE SET NULL,
  turn_no integer NOT NULL CHECK (turn_no > 0),
  actor_type text NOT NULL CHECK (actor_type IN ('founder', 'ai', 'system')),
  content text NOT NULL,
  model text,
  prompt_version text,
  structured_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(structured_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_no)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  context_packet_id uuid REFERENCES context_packets(id) ON DELETE SET NULL,
  recommendation jsonb NOT NULL CHECK (jsonb_typeof(recommendation) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_sessions_project_status_idx ON conversation_sessions(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_turns_project_created_idx ON conversation_turns(project_id, created_at, turn_no);
CREATE INDEX IF NOT EXISTS context_packets_project_created_idx ON context_packets(project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS recommendations_one_active_per_project_idx ON recommendations(project_id) WHERE status = 'active';
