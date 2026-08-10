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
let modelSawPersistedFounderTurn = false;
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
    generateAssistant: async ({ contextPacket, founderTurn, message }) => {
      if (message === "return invalid") return null;
      if (message === "return structurally invalid") return [];
      if (message === "return contract invalid") return { assistant_message: "Missing required contract fields" };
      if (message === "inspect persistence") {
        const persisted = await pool.query("SELECT t.id FROM conversation_turns t JOIN context_packets p ON p.id=t.context_packet_id WHERE t.id=$1 AND p.id=$2", [founderTurn.id, contextPacket.id]);
        modelSawPersistedFounderTurn = persisted.rowCount === 1;
        return null;
      }
      if (message === "model outage") throw new Error("test model outage");
      const flowState = { "flow question": "question", "flow task": "task", "flow experiment": "experiment", "flow evidence": "wait" }[message];
      if (flowState) {
        const records = {
          "flow task": [{ type: "task", payload: { title: "Record completed outreach", justification: "Captures the reported task result." }, source_ids: [contextPacket.id, founderTurn.id] }],
          "flow experiment": [{ type: "experiment", payload: { title: "Record experiment result", hypothesis: "The paid pilot ask works", success_metric: "Three deposits", justification: "Captures the reported experiment result." }, source_ids: [contextPacket.id, founderTurn.id] }],
          "flow evidence": [{ type: "evidence", payload: { source_type: "founder_report", source_title: "Founder result", summary: "Three prospects described the same problem." }, source_ids: [contextPacket.id, founderTurn.id] }]
        }[message] || [];
        return {
          assistant_message: `Handled ${message}.`, model: "test-assistant", prompt_version: "test-v1",
          proposed_belief_updates: message === "flow question" ? [{ statement: "The founder clarified the current blocker.", classification: "founder_statement", source_ids: [contextPacket.id, founderTurn.id] }] : [],
          proposed_records: records,
          recommendation: { state: flowState, primary_issue: "Payment evidence is incomplete", reason: "The update maps to one focused next state.", action_payload: {}, confidence: 0.6, source_ids: [contextPacket.id, founderTurn.id] },
          needs_founder_review: true
        };
      }
      if (message === "make material proposal" || message === "reject material proposal") return {
        assistant_message: message === "reject material proposal" ? "Proposal validation failure" : "Create a founder outreach task.", model: "test-assistant", prompt_version: "test-v1",
        proposed_belief_updates: [], proposed_records: [{ type: "task", payload: { title: "Ask five founders", justification: "Tests the current uncertainty." }, source_ids: [contextPacket.id, founderTurn.id] }],
        recommendation: { state: "task", primary_issue: "No payment evidence", reason: "A paid ask tests willingness to pay.", action_payload: { title: "Ask five founders" }, confidence: 0.6, source_ids: [contextPacket.id, founderTurn.id] }, needs_founder_review: true
      };
      return {
      assistant_message: "Ask five founders for a paid pilot.", model: "test-assistant", prompt_version: "test-v1",
      structured_payload: { proposal: "paid-pilot" }, recommendation: { state: "task", primary_issue: "No payment evidence", reason: "A paid ask tests willingness to pay.", action_payload: { title: "Ask five founders" }, confidence: 0.6, source_ids: [contextPacket.id, founderTurn.id] },
      included_memory_record_ids: contextPacket.included_memory_record_ids
      };
    },
    proposeChangeSet: async (projectId, output, options) => {
      if (output.assistant_message === "Proposal validation failure") throw Object.assign(new Error("forced proposal validation failure"), { code: "INVALID_CHANGE_SET" });
      return require("../change_sets").proposeChangeSet(projectId, output, options);
    }
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
    assert.deepEqual(posted.recommendation.recommendation.source_ids, []);
    const linkage = (await pool.query("SELECT session.project_id AS session_project_id, packet.project_id AS context_project_id, founder.project_id AS founder_project_id, assistant.project_id AS assistant_project_id, recommendation.project_id AS recommendation_project_id FROM conversation_sessions session JOIN context_packets packet ON packet.id=$2 JOIN conversation_turns founder ON founder.id=$3 JOIN conversation_turns assistant ON assistant.id=$4 JOIN recommendations recommendation ON recommendation.id=$5 WHERE session.id=$1", [posted.founder_turn.session_id, posted.context_packet.id, posted.founder_turn.id, posted.assistant_turn.id, posted.recommendation.id])).rows[0];
    assert.deepEqual(Object.values(linkage), Array(5).fill(project.id));
    const history = await json(await api(`/api/projects/${project.id}/chat`));
    assert.deepEqual(history.turns.map(turn => turn.actor_type), ["founder", "ai"]);
    assert.deepEqual(history.turns.map(turn => turn.turn_no), [1, 2]);
    const recommendation = await json(await api(`/api/projects/${project.id}/recommendation`));
    assert.equal(recommendation.recommendation.recommendation.state, "question");
    assert.equal(recommendation.recommendation.context_packet_id, posted.context_packet.id);
    const audit = await pool.query("SELECT actor_type, actor_id, event_type, entity_type, entity_id FROM event_log WHERE project_id=$1 AND entity_id = ANY($2::uuid[]) ORDER BY created_at", [project.id, [posted.founder_turn.id, posted.assistant_turn.id]]);
    assert.deepEqual(audit.rows.map(row => [row.actor_type, row.actor_id, row.event_type, row.entity_type]), [["founder", owner, "created", "conversation_turn"], ["ai", owner, "created", "conversation_turn"]]);
    assert.equal((await api(`/api/projects/${project.id}/chat`, { headers: { "x-user-id": "someone-else" } })).status, 404);
    assert.equal((await api(`/api/projects/${project.id}`, { method: "DELETE" })).status, 204);
});

test("chat persists founder context before malformed, structural, contract-invalid output, or model failure", async () => {
  const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Chat failures" } }))).project;
  modelSawPersistedFounderTurn = false;
  const observed = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message: "inspect persistence" } }));
  assert.equal(observed.error.code, "invalid_model_output");
  assert.equal(modelSawPersistedFounderTurn, true);
  for (const [message, code] of [["return invalid", "invalid_model_output"], ["return structurally invalid", "invalid_model_output"], ["return contract invalid", "invalid_model_output"], ["model outage", "model_failure"]]) {
    const response = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message } }));
    assert.equal(response.error.code, code);
    assert.ok(response.founder_turn.id);
    assert.ok(response.context_packet.id);
    assert.ok(response.assistant_turn.id);
    assert.ok(response.recommendation.id);
    const persisted = await pool.query("SELECT t.id AS turn_id, p.id AS packet_id FROM conversation_turns t JOIN context_packets p ON p.id=t.context_packet_id WHERE t.id=$1", [response.founder_turn.id]);
    assert.deepEqual(persisted.rows[0], { turn_id: response.founder_turn.id, packet_id: response.context_packet.id });
  }
  await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("material chat proposals are pending, provenance-controlled, idempotent, and never directly mutate memory", async () => {
  const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Material chat" } }))).project;
  const body = { message: "make material proposal", client_request_id: "material-retry-1" };
  const posted = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body }));
  assert.equal(posted.change_set.status, "pending_review");
  assert.equal(posted.change_set.source_turn_id, posted.assistant_turn.id);
  assert.equal(posted.change_set.items.length, 1);
  assert.equal(posted.change_set.items[0].record_type, "task");
  assert.equal(posted.change_set.proposal_metadata.provenance.founder_turn_id, posted.founder_turn.id);
  assert.equal(posted.change_set.proposal_metadata.provenance.assistant_turn_id, posted.assistant_turn.id);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM tasks WHERE project_id=$1", [project.id])).rows[0].count, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM beliefs WHERE project_id=$1", [project.id])).rows[0].count, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM recommendations WHERE project_id=$1", [project.id])).rows[0].count, 1);
  const replay = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body }));
  assert.equal(replay.change_set.reused, true);
  assert.equal(replay.change_set.id, posted.change_set.id);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM change_sets WHERE project_id=$1", [project.id])).rows[0].count, 1);
  await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("chat model proposals cannot override the deterministic no-issue wait rule", async () => {
  const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Flow coverage" } }))).project;
  for (const [message, state] of [["flow question", "question"], ["flow task", "task"], ["flow experiment", "experiment"], ["flow evidence", "wait"]]) {
    const posted = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message, client_request_id: `${message}-retry-key` } }));
    assert.equal(posted.recommendation.recommendation.state, "question");
    assert.ok(posted.assistant_turn.id);
    if (message === "flow question") assert.equal(posted.change_set.items[0].record_type, "belief");
    if (message === "flow task") assert.equal(posted.change_set.items[0].record_type, "task");
    if (message === "flow experiment") assert.equal(posted.change_set.items[0].record_type, "experiment");
    if (message === "flow evidence") assert.equal(posted.change_set.items[0].record_type, "evidence");
  }
  await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("chat reports change-set validation failures after saving a valid assistant turn and supersedes recommendations", async () => {
  const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Proposal failure" } }))).project;
  await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message: "first turn" } }));
  const second = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message: "second turn" } }));
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM recommendations WHERE project_id=$1 AND status='active'", [project.id])).rows[0].count, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM recommendations WHERE project_id=$1 AND status='superseded'", [project.id])).rows[0].count, 1);
  assert.ok(second.recommendation.id);
  const failure = await json(await api(`/api/projects/${project.id}/chat`, { method: "POST", body: { message: "reject material proposal" } }));
  assert.ok(failure.assistant_turn.id);
  assert.equal(failure.proposal_error.code, "INVALID_CHANGE_SET");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM change_sets WHERE project_id=$1", [project.id])).rows[0].count, 0);
  await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("recommendation has an explicit empty state", async () => {
    const project = (await json(await api("/api/projects", { method: "POST", body: { name: "No recommendation" } }))).project;
    assert.deepEqual(await json(await api(`/api/projects/${project.id}/recommendation`)), { recommendation: null });
    await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("state changes recalculate atomically and preserve readable recommendation history", async () => {
  const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Recommendation triggers" } }))).project;
  const assumption = (await json(await api(`/api/projects/${project.id}/assumptions`, { method: "POST", body: { statement: "Operators will pay", category: "willingness_to_pay", importance: 3, uncertainty: 2, risk_score: 40 } }))).assumption;
  assert.equal((await json(await api(`/api/projects/${project.id}/recommendation`))).recommendation.state, "question");
  await json(await api(`/api/projects/${project.id}`, { method: "PATCH", body: { target_customer: "Independent operators" } }));
  await json(await api(`/api/projects/${project.id}/evidence`, { method: "POST", body: { source_type: "interview", source_title: "Interview", summary: "One operator described the problem" } }));
  const experiment = (await json(await api(`/api/projects/${project.id}/experiments`, { method: "POST", body: { assumption_id: assumption.id, title: "Paid offer", hypothesis: "Operators will pay", success_metric: "One deposit" } }))).experiment;
  assert.equal((await json(await api(`/api/projects/${project.id}/recommendation`))).recommendation.state, "wait");
  await json(await api(`/api/projects/${project.id}/experiments/${experiment.id}`, { method: "PATCH", body: { status: "completed" } }));
  const task = (await json(await api(`/api/projects/${project.id}/tasks`, { method: "POST", body: { assumption_id: assumption.id, title: "Ask one operator" } }))).task;
  await json(await api(`/api/projects/${project.id}/tasks/${task.id}`, { method: "PATCH", body: { status: "doing" } }));
  assert.equal((await json(await api(`/api/projects/${project.id}/recommendation`))).recommendation.state, "wait");
  await json(await api(`/api/projects/${project.id}/tasks/${task.id}`, { method: "PATCH", body: { status: "done" } }));
  const history = await json(await api(`/api/projects/${project.id}/recommendation/history`));
  assert.ok(history.recommendations.length >= 7);
  assert.equal(history.recommendations.filter(item => item.status === "active").length, 1);
  assert.ok(history.recommendations[0].source_context.packet);
  assert.ok(history.recommendations.some(item => item.supersedes_id));
  assert.equal(new Set(history.recommendations.map(item => item.version)).size, history.recommendations.length);
  const ids = new Set(history.recommendations.map(item => item.id));
  assert.ok(history.recommendations.filter(item => item.supersedes_id).every(item => ids.has(item.supersedes_id)));
  await api(`/api/projects/${project.id}`, { method: "DELETE" });
});

test("nested chat and recommendation paths are not matched", async () => {
    const project = (await json(await api("/api/projects", { method: "POST", body: { name: "Route tightness" } }))).project;
    assert.equal((await api(`/api/projects/${project.id}/chat/extra`)).status, 404);
    assert.equal((await api(`/api/projects/${project.id}/recommendation/extra`)).status, 404);
    assert.equal((await api(`/api/projects/${project.id}`, { method: "DELETE" })).status, 204);
});
