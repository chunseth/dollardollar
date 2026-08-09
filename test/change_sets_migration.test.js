const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const migration = fs.readFileSync(path.join(__dirname, "../migrations/005_ai_change_sets.sql"), "utf8");

test("Phase 5 migration defines bounded change-set lifecycle, JSON checks, and review indexes", () => {
  for (const token of [
    "CREATE TABLE IF NOT EXISTS change_sets", "CREATE TABLE IF NOT EXISTS change_set_items",
    "ai_change_sets_require_source_turn", "change_sets_source_turn_project_fkey",
    "UNIQUE (project_id, idempotency_key)", "UNIQUE (change_set_id, sequence_number)",
    "jsonb_typeof(original_payload) = 'object'", "jsonb_typeof(current_payload) = 'object'",
    "change_sets_project_pending_review_idx", "change_sets_project_lifecycle_idx",
    "change_set_items_change_set_review_idx"
  ]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, /status IN \('pending_review','partially_approved','approved','rejected','applying','applied','failed','expired'\)/);
  assert.match(migration, /operation IN \('create','update','link'\)/);
  assert.match(migration, /review_status IN \('pending','approved','rejected','applied'\)/);
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createStore() {
  let state = { sets: [], items: [], tasks: [], events: [], calls: [], nextSet: 1, nextItem: 1, nextTask: 1 };
  const result = rows => ({ rows, rowCount: rows.length });
  const query = async (sql, params = []) => {
    const text = sql.replace(/\s+/g, " ").trim().toLowerCase();
    state.calls.push({ text, params: clone(params) });
    if (text.startsWith("select user_id from projects")) return result([{ user_id: "founder-1" }]);
    if (text.startsWith("select id from projects")) return result([{ id: params[0] }]);
    if (text.startsWith("select id from conversation_turns")) return result(params[0] === "turn-1" ? [{ id: "turn-1" }] : []);
    if (text.startsWith("select * from assumptions") || text.startsWith("select * from evidence") || text.startsWith("select * from tasks where project_id") || text.startsWith("select * from experiments") || text.startsWith("select ae.* from assumption_evidence")) return result([]);
    if (text.startsWith("select * from change_sets where project_id")) return result(state.sets.filter(set => set.project_id === params[0] && set.idempotency_key === params[1]));
    if (text.startsWith("insert into change_sets")) {
      const set = { id: `set-${state.nextSet++}`, project_id: params[0], source_turn_id: params[1], origin: "ai", rationale: params[2], proposal_metadata: params[3], idempotency_key: params[4], expires_at: params[5], status: "pending_review", application_metadata: {} };
      state.sets.push(set); return result([set]);
    }
    if (text.startsWith("insert into change_set_items")) {
      const item = { id: `item-${state.nextItem++}`, change_set_id: params[0], sequence_number: params[1], record_type: params[2], operation: params[3], target_entity_id: params[4], original_payload: params[5], current_payload: params[5], review_status: "pending" };
      state.items.push(item); return result([item]);
    }
    if (text.startsWith("select * from change_set_items where id")) return result(state.items.filter(item => item.id === params[0] && item.change_set_id === params[1]));
    if (text.startsWith("select * from change_set_items")) return result(state.items.filter(item => item.change_set_id === params[0]).sort((a, b) => a.sequence_number - b.sequence_number));
    if (text.startsWith("select * from change_sets where id")) return result(state.sets.filter(set => set.id === params[0] && set.project_id === params[1]));
    if (text.startsWith("update change_set_items set current_payload")) {
      const item = state.items.find(candidate => candidate.id === params[0]); item.current_payload = params[1]; return result([item]);
    }
    if (text.startsWith("update change_set_items set review_status='approved'")) {
      const selected = params[2];
      for (const item of state.items.filter(candidate => candidate.change_set_id === params[0] && (selected === undefined ? candidate.review_status === "pending" : selected.includes(candidate.id)))) { item.review_status = "approved"; item.reviewed_by = params[1]; }
      return result([]);
    }
    if (text.startsWith("update change_set_items set review_status='rejected'")) {
      for (const item of state.items.filter(candidate => candidate.change_set_id === params[0] && ["pending", "approved"].includes(candidate.review_status))) item.review_status = "rejected";
      return result([]);
    }
    if (text.startsWith("update change_set_items set review_status='applied'")) {
      const item = state.items.find(candidate => candidate.id === params[0]); item.review_status = "applied"; item.application_result_metadata = params[1]; return result([item]);
    }
    if (text.startsWith("update change_sets set status='approved'")) { const set = state.sets.find(candidate => candidate.id === params[0]); set.status = "approved"; set.approved_by = params[1]; return result([set]); }
    if (text.startsWith("update change_sets set status=$2")) { const set = state.sets.find(candidate => candidate.id === params[0]); set.status = params[1]; return result([set]); }
    if (text.startsWith("update change_sets set status='rejected'")) { const set = state.sets.find(candidate => candidate.id === params[0]); set.status = "rejected"; return result([set]); }
    if (text.startsWith("update change_sets set status='applying'")) { const set = state.sets.find(candidate => candidate.id === params[0]); set.status = "applying"; return result([]); }
    if (text.startsWith("update change_sets set status='applied'")) { const set = state.sets.find(candidate => candidate.id === params[0]); set.status = "applied"; set.application_metadata = params[2]; return result([set]); }
    if (text.startsWith("update change_sets set status='failed'")) { const set = state.sets.find(candidate => candidate.id === params[0] && candidate.project_id === params[2] && ["approved", "applying"].includes(candidate.status)); if (!set) return result([]); set.status = "failed"; set.application_metadata = { ...set.application_metadata, ...JSON.parse(params[1]) }; return result([set]); }
    if (text.startsWith("insert into tasks")) { if (params.includes("__FAIL__")) throw new Error("forced task insert failure"); const task = { id: `task-${state.nextTask++}`, project_id: params[0], title: params[1] }; state.tasks.push(task); return result([task]); }
    if (text.startsWith("insert into event_log")) { const event = { project_id: params[0], actor_type: params[1], actor_id: params[2], event_type: params[3], entity_type: params[4], entity_id: params[5], payload: params[7] }; state.events.push(event); return result([event]); }
    throw new Error(`Unhandled test query: ${text}`);
  };
  return {
    query,
    transaction: async work => { const snapshot = clone(state); try { return await work({ query }); } catch (error) { state = snapshot; throw error; } },
    get state() { return state; }
  };
}

function loadService(store) {
  const dbPath = require.resolve("../db"), servicePath = require.resolve("../change_sets");
  delete require.cache[servicePath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: store.query, transaction: store.transaction } };
  return require("../change_sets");
}

const proposal = (key, title = "Call five founders") => ({ source_turn_id: "turn-1", idempotency_key: key, items: [{ record_type: "task", operation: "create", payload: { title, source_ids: ["turn-1"], justification: "Tests the current uncertainty." } }] });

test("change-set proposal validation and idempotency are deterministic", async () => {
  const store = createStore(), service = loadService(store);
  await assert.rejects(() => service.proposeChangeSet("project-1", { ...proposal("bad"), items: [{ record_type: "evidence", operation: "create", payload: { source_ids: ["turn-1"] } }] }), /Evidence proposals require/);
  await assert.rejects(() => service.proposeChangeSet("project-1", { ...proposal("bad-link"), items: [{ record_type: "task", operation: "link", target_entity_id: "task-1", payload: { source_ids: ["turn-1"] } }] }), /Link operations are only supported/);
  const created = await service.proposeChangeSet("project-1", proposal("same-key"));
  const reused = await service.proposeChangeSet("project-1", proposal("same-key"));
  assert.equal(created.reused, false);
  assert.equal(reused.reused, true);
  assert.equal(store.state.sets.length, 1);
  assert.deepEqual(store.state.events.map(event => event.event_type), ["proposed"]);
  assert.equal(store.state.events[0].actor_type, "ai");
});

test("founder review workflow enforces authorization, edit, selected approval, full approval, and rejection", async () => {
  const store = createStore(), service = loadService(store);
  const set = await service.proposeChangeSet("project-1", { ...proposal("review"), items: [proposal("a").items[0], proposal("b", "Send follow-up").items[0]] });
  await assert.rejects(() => service.approveChangeSet("project-1", set.id), /Founder authorization context is required/);
  await assert.rejects(() => service.approveChangeSet("project-1", set.id, { actor_id: "someone-else" }), /not authorized/);
  await service.editChangeSetItem("project-1", set.id, set.items[1].id, { title: "Send a tailored follow-up", source_ids: ["turn-1"], justification: "Keeps the proposal focused." }, { actor_id: "founder-1" });
  const partial = await service.approveChangeSetItems("project-1", set.id, [set.items[0].id], { actor_id: "founder-1" });
  assert.equal(partial.status, "partially_approved");
  const approved = await service.approveChangeSet("project-1", set.id, { actor_id: "founder-1" });
  assert.equal(approved.status, "approved");
  const rejected = await service.proposeChangeSet("project-1", proposal("reject"));
  assert.equal((await service.rejectChangeSet("project-1", rejected.id, { actor_id: "founder-1" }, "Not now")).status, "rejected");
  assert.deepEqual(store.state.events.map(event => event.event_type), ["proposed", "edited", "approved_selected", "approved", "proposed", "rejected"]);
});

test("approved application is atomic, audited, and records failure separately without retaining item writes", async () => {
  const store = createStore(), service = loadService(store);
  const success = await service.proposeChangeSet("project-1", proposal("apply"));
  await service.approveChangeSet("project-1", success.id, { actor_id: "founder-1" });
  assert.equal((await service.applyApprovedChangeSet("project-1", success.id, { actor_id: "founder-1" })).status, "applied");
  assert.equal((await service.applyApprovedChangeSet("project-1", success.id, { actor_id: "founder-1" })).idempotent, true);
  const failed = await service.proposeChangeSet("project-1", { ...proposal("fail", "__FAIL__"), idempotency_key: "fail" });
  await service.approveChangeSet("project-1", failed.id, { actor_id: "founder-1" });
  await assert.rejects(() => service.applyApprovedChangeSet("project-1", failed.id, { actor_id: "founder-1" }), /forced task insert failure/);
  assert.equal(store.state.tasks.length, 1);
  assert.equal(store.state.sets.find(set => set.id === failed.id).status, "failed");
  assert.equal(store.state.items.find(item => item.change_set_id === failed.id).review_status, "approved");
  assert.deepEqual(store.state.events.filter(event => event.entity_id === failed.id).map(event => event.event_type), ["proposed", "approved", "failed"]);
  assert.equal(store.state.events.filter(event => event.event_type === "applied").length, 2);
});
