const test = require("node:test");
const assert = require("node:assert/strict");
require("../env").loadEnv();
const { memoryRecordIds, placeholderAssistant, validateAssistantPayload } = require("../server");

test("the deterministic assistant payload contract is explicit and replayable", () => {
  const contextPacket = { id: "context-1", included_memory_record_ids: { project: ["project-1"], assumptions: ["assumption-1"] } };
  const founderTurn = { id: "turn-1" };
  const payload = placeholderAssistant({ contextPacket, founderTurn });
  assert.equal(validateAssistantPayload(payload), payload);
  assert.equal(payload.model, "local-placeholder");
  assert.equal(payload.prompt_version, "conversation-loop-v1");
  assert.deepEqual(payload.included_memory_record_ids, contextPacket.included_memory_record_ids);
  assert.deepEqual(payload.recommendation.source_ids, ["context-1", "turn-1"]);
});

test("memory record ids are JSON-safe stable strings", () => {
  assert.deepEqual(memoryRecordIds({ project: { id: "project-1" }, assumptions: [{ id: "a-1" }, { id: "a-2" }], evidence: [] }), { project: ["project-1"], assumptions: ["a-1", "a-2"], evidence: [] });
});

const { createServer } = require("../server");
const { pool } = require("../db");
const owner = `chat-founder-${Date.now()}`;
let server, baseUrl;
const api = (path, options = {}) => fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", "x-user-id": owner, ...(options.headers || {}) }, body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body });
const json = async response => { const body = await response.json(); assert.equal(response.ok, true, JSON.stringify(body)); return body; };

test.before(async () => {
  await pool.query(`
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
    CREATE UNIQUE INDEX IF NOT EXISTS recommendations_one_active_per_project_idx ON recommendations(project_id) WHERE status = 'active';
  `);
  server = createServer({
    generateAssistant: async ({ contextPacket, founderTurn }) => ({
      assistant_message: "Ask five founders for a paid pilot.", model: "test-assistant", prompt_version: "test-v1",
      structured_payload: { proposal: "paid-pilot" }, recommendation: { state: "task", primary_issue: "No payment evidence", reason: "A paid ask tests willingness to pay.", action_payload: { title: "Ask five founders" }, confidence: 0.6, source_ids: [contextPacket.id, founderTurn.id] },
      included_memory_record_ids: contextPacket.included_memory_record_ids
    })
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });

test("chat persists ordered turns, context linkage, and a current recommendation", async () => {
    const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Conversation smoke" } }))).project;
    const posted = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message: "I talked to three prospects." } }));
    assert.equal(posted.founder_turn.context_packet_id, posted.context_packet.id);
    assert.equal(posted.assistant_turn.context_packet_id, posted.context_packet.id);
    assert.deepEqual(posted.context_packet.included_memory_record_ids.project, [project.id]);
    assert.deepEqual(posted.context_packet.data.memory_record_ids.project, [project.id]);
    assert.deepEqual(posted.recommendation.recommendation.source_ids, [posted.context_packet.id, posted.founder_turn.id]);
    const linkage = (await pool.query("SELECT session.project_id AS session_project_id, packet.project_id AS context_project_id, founder.project_id AS founder_project_id, assistant.project_id AS assistant_project_id, recommendation.project_id AS recommendation_project_id FROM conversation_sessions session JOIN context_packets packet ON packet.id=$2 JOIN conversation_turns founder ON founder.id=$3 JOIN conversation_turns assistant ON assistant.id=$4 JOIN recommendations recommendation ON recommendation.id=$5 WHERE session.id=$1", [posted.founder_turn.session_id, posted.context_packet.id, posted.founder_turn.id, posted.assistant_turn.id, posted.recommendation.id])).rows[0];
    assert.deepEqual(Object.values(linkage), Array(5).fill(project.id));
    const history = await json(await api(`/api/projects/${project.id}/chat`));
    assert.deepEqual(history.turns.map(turn => turn.actor_type), ["founder", "ai"]);
    assert.deepEqual(history.turns.map(turn => turn.turn_no), [1, 2]);
    const recommendation = await json(await api(`/api/projects/${project.id}/recommendation`));
    assert.equal(recommendation.recommendation.recommendation.state, "task");
    assert.equal(recommendation.recommendation.context_packet_id, posted.context_packet.id);
    assert.equal((await api(`/api/projects/${project.id}/chat`, { headers: { "x-user-id": "someone-else" } })).status, 404);
    assert.equal((await api(`/api/projects/${project.id}`, { method: "DELETE" })).status, 204);
});

test("recommendation has an explicit empty state", async () => {
    const project = (await json(await api("/api/projects", { method: "POST", body: { name: "No recommendation" } }))).project;
    assert.deepEqual(await json(await api(`/api/projects/${project.id}/recommendation`)), { recommendation: null });
    await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("nested chat and recommendation paths are not matched", async () => {
    const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Route tightness" } }))).project;
    assert.equal((await api(`/api/projects/${project.id}/chat/extra`)).status, 404);
    assert.equal((await api(`/api/projects/${project.id}/recommendation/extra`)).status, 404);
    assert.equal((await api(`/api/projects/${project.id}`, { method: "DELETE" })).status, 204);
});
