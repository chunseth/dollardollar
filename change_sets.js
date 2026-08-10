"use strict";

const { query, transaction } = require("./db");
const { appendBeliefVersion, linkEvidenceToBeliefVersion } = require("./beliefs");
const { nextStates, beliefClassifications, validateCofounderOutput } = require("./ai_cofounder_contract");
const { topUnresolvedIssue } = require("./context");

const TYPES = new Set(["belief", "evidence", "task", "experiment", "decision", "recommendation"]);
const OPERATIONS = new Set(["create", "update", "link"]);
const MAX_ITEMS = 25, MAX_PAYLOAD_BYTES = 32_000, MAX_STRING = 4_000, MAX_DEPTH = 5, MAX_KEYS = 60;
const editable = {
  belief: new Set(["statement", "classification", "validation_status", "confidence", "importance", "scope", "rationale", "source_ids", "evidence_links", "provenance", "source_assumption_id", "top_unresolved_issue_id", "justification"]),
  evidence: new Set(["source_type", "source_title", "summary", "raw_text", "source_date", "source_person_name", "source_company", "strength", "confidence", "specificity", "recency", "bias_risk", "willingness_to_pay_signal", "behavior_vs_opinion", "source_ids", "provenance"]),
  task: new Set(["title", "description", "priority", "status", "due_date", "estimated_minutes", "impact_level", "effort_level", "assumption_id", "experiment_id", "source_ids", "provenance", "top_unresolved_issue_id", "justification"]),
  experiment: new Set(["title", "hypothesis", "test_design", "success_metric", "success_threshold", "status", "expected_duration", "owner", "started_at", "completed_at", "assumption_id", "source_ids", "provenance", "top_unresolved_issue_id", "justification"]),
  decision: new Set(["title", "decision", "reason", "status", "decided_at", "source_ids", "provenance"]),
  recommendation: new Set(["state", "primary_issue", "reason", "action_payload", "confidence", "source_ids", "provenance"])
};
const tableFor = { belief: "beliefs", evidence: "evidence", task: "tasks", experiment: "experiments", decision: "decisions", recommendation: "recommendations" };
const fail = message => { const error = new Error(message); error.code = "INVALID_CHANGE_SET"; error.status = 422; return error; };
const object = value => value && typeof value === "object" && !Array.isArray(value);
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const executor = value => value && typeof value.query === "function";
function jsonBounds(value, depth = 0) {
  if (depth > MAX_DEPTH) throw fail("Proposal data is nested too deeply");
  if (typeof value === "string" && value.length > MAX_STRING) throw fail("Proposal string is too long");
  if (Array.isArray(value)) { if (value.length > MAX_KEYS) throw fail("Proposal array is too large"); value.forEach(item => jsonBounds(item, depth + 1)); }
  else if (object(value)) { if (Object.keys(value).length > MAX_KEYS) throw fail("Proposal object has too many fields"); Object.values(value).forEach(item => jsonBounds(item, depth + 1)); }
}
function payloadBytes(value) { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
function normalizePayload(payload) {
  if (!object(payload)) throw fail("Change-set payload must be an object");
  jsonBounds(payload); if (payloadBytes(payload) > MAX_PAYLOAD_BYTES) throw fail("Change-set payload is too large");
  return payload;
}
function normalizedItems(aiPayload, includeRecommendation = true) {
  if (!object(aiPayload)) throw fail("AI proposal must be an object");
  const items = Array.isArray(aiPayload.items) ? [...aiPayload.items] : (() => {
    const beliefs = aiPayload.proposed_belief_updates || [];
    const records = aiPayload.proposed_records || [];
    if (!Array.isArray(beliefs) || !Array.isArray(records)) throw fail("AI proposal items must be arrays");
    return [...beliefs.map(payload => ({ record_type: "belief", operation: payload.target_entity_id ? "update" : "create", target_entity_id: payload.target_entity_id, payload })), ...records.map(record => ({ record_type: record.type, operation: record.operation || "create", target_entity_id: record.target_entity_id, payload: { ...record.payload, source_ids: record.source_ids } }))];
  })();
  if (includeRecommendation && aiPayload.recommendation !== undefined) items.push({ record_type: "recommendation", operation: "create", payload: aiPayload.recommendation });
  return items;
}
async function projectRecord(client, projectId) { const result = await client.query("SELECT id FROM projects WHERE id=$1", [projectId]); if (!result.rowCount) throw fail("Project not found"); }
async function sourceTurn(client, projectId, id) { const result = await client.query("SELECT id FROM conversation_turns WHERE id=$1 AND project_id=$2", [id, projectId]); if (!result.rowCount) throw fail("source_turn_id must belong to the project"); }
async function owns(client, table, projectId, id, label) { const result = await client.query(`SELECT id FROM ${table} WHERE id=$1 AND project_id=$2`, [id, projectId]); if (!result.rowCount) throw fail(`${label} must belong to the project`); }
async function sourceIds(client, projectId, ids) {
  if (!Array.isArray(ids) || !ids.length || !ids.every(nonEmpty)) throw fail("Material changes require source_ids provenance");
  for (const id of ids) {
    const result = await client.query("SELECT id FROM conversation_turns WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM context_packets WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM evidence WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM assumptions WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM beliefs WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM tasks WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM experiments WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM decisions WHERE id=$1 AND project_id=$2 UNION ALL SELECT id FROM recommendations WHERE id=$1 AND project_id=$2", [id, projectId]);
    if (!result.rowCount) throw fail("Provenance source IDs must belong to the project");
  }
}
async function currentTopIssue(client, projectId) {
  const assumptions = await client.query("SELECT * FROM assumptions WHERE project_id=$1", [projectId]);
  const evidence = await client.query("SELECT * FROM evidence WHERE project_id=$1", [projectId]);
  const tasks = await client.query("SELECT * FROM tasks WHERE project_id=$1", [projectId]);
  const experiments = await client.query("SELECT * FROM experiments WHERE project_id=$1", [projectId]);
  const links = await client.query("SELECT ae.* FROM assumption_evidence ae JOIN assumptions a ON a.id=ae.assumption_id WHERE a.project_id=$1", [projectId]);
  return topUnresolvedIssue({ assumptions: assumptions.rows, evidence: evidence.rows, tasks: tasks.rows, experiments: experiments.rows, assumption_evidence: links.rows });
}
async function validateItem(client, projectId, item, expectedTopIssue) {
  if (!object(item) || !TYPES.has(item.record_type || item.type) || !OPERATIONS.has(item.operation)) throw fail("Unsupported change-set record type or operation");
  const record_type = item.record_type || item.type, operation = item.operation, payload = normalizePayload(item.payload);
  if (operation === "link" && record_type !== "belief") throw fail("Link operations are only supported for beliefs");
  if (operation === "link" && (!Array.isArray(payload.evidence_links) || !payload.evidence_links.length)) throw fail("Belief link operations require evidence_links");
  if (record_type === "recommendation" && operation !== "create") throw fail("Recommendations only support create operations");
  if (Object.keys(payload).some(key => !editable[record_type].has(key))) throw fail(`Unsupported ${record_type} proposal field`);
  if (operation === "create" && item.target_entity_id) throw fail("Create operations cannot target an existing entity");
  if (operation !== "create" && !nonEmpty(item.target_entity_id)) throw fail("Update and link operations require a target entity ID");
  if (item.target_entity_id) await owns(client, tableFor[record_type], projectId, item.target_entity_id, "Target entity");
  await sourceIds(client, projectId, payload.source_ids);
  if (payload.assumption_id) await owns(client, "assumptions", projectId, payload.assumption_id, "Assumption");
  if (payload.experiment_id) await owns(client, "experiments", projectId, payload.experiment_id, "Experiment");
  if (payload.source_assumption_id) await owns(client, "assumptions", projectId, payload.source_assumption_id, "Source assumption");
  if (record_type === "belief") {
    if (operation === "create" && (!nonEmpty(payload.statement) || !beliefClassifications.includes(payload.classification))) throw fail("New belief proposals require a valid statement and classification");
    if (payload.statement !== undefined && !nonEmpty(payload.statement)) throw fail("Belief statement must be non-empty");
    if (payload.classification !== undefined && !beliefClassifications.includes(payload.classification)) throw fail("Belief classification is invalid");
    if (["finding", "evidence_observation"].includes(payload.classification) && (!Array.isArray(payload.evidence_links) || !payload.evidence_links.length)) throw fail("Evidence-free belief upgrades are not allowed");
    for (const link of payload.evidence_links || []) { if (!object(link) || !nonEmpty(link.source_id) || !["supports", "contradicts", "mixed", "neutral"].includes(link.relationship)) throw fail("Invalid belief evidence link"); await owns(client, "evidence", projectId, link.source_id, "Evidence"); }
  }
  if (operation === "create" && record_type === "evidence" && (!nonEmpty(payload.source_type) || !nonEmpty(payload.source_title) || !nonEmpty(payload.summary))) throw fail("Evidence proposals require source_type, source_title, and summary");
  if (operation === "create" && record_type === "task" && !nonEmpty(payload.title)) throw fail("Task proposals require a title");
  if (operation === "create" && record_type === "experiment" && (!nonEmpty(payload.title) || !nonEmpty(payload.hypothesis) || !nonEmpty(payload.success_metric))) throw fail("Experiment proposals require title, hypothesis, and success_metric");
  if (operation === "create" && record_type === "decision" && (!nonEmpty(payload.title) || !nonEmpty(payload.decision))) throw fail("Decision proposals require title and decision");
  if (operation === "create" && record_type === "recommendation" && (!nextStates.includes(payload.state) || !nonEmpty(payload.primary_issue) || !nonEmpty(payload.reason) || !object(payload.action_payload) || typeof payload.confidence !== "number" || payload.confidence < 0 || payload.confidence > 1)) throw fail("Recommendation proposals require a valid state, issue, reason, action_payload, and confidence");
  if (["task", "experiment"].includes(record_type) && (payload.top_unresolved_issue_id !== expectedTopIssue?.assumption_id) && !nonEmpty(payload.justification)) throw fail("Tasks and experiments require the current top unresolved issue or a justification");
  return { record_type, operation, target_entity_id: item.target_entity_id || null, payload };
}
async function auth(executor, projectId, context = {}) {
  if (!context || (!context.actor_id && !context.actorId)) throw fail("Founder authorization context is required");
  if (context.project_id && context.project_id !== projectId) throw fail("Authorization context project does not match");
  const actor = context.actor_id || context.actorId;
  const run = typeof executor === "function" ? executor : executor.query;
  const project = await run("SELECT user_id FROM projects WHERE id=$1", [projectId]);
  if (!project.rowCount || (project.rows[0].user_id && project.rows[0].user_id !== actor)) throw fail("Founder is not authorized for this project");
  return actor;
}
async function audit(client, projectId, actorType, actor, event, entityType, entityId, payload) { return (await client.query("INSERT INTO event_log (project_id,actor_type,actor_id,event_type,entity_type,entity_id,summary,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [projectId, actorType, actor, event, entityType, entityId, `Change set ${event}`, payload])).rows[0]?.id || null; }

async function proposeChangeSet(projectId, aiPayload, options = {}) {
  return transaction(async client => {
    await projectRecord(client, projectId);
    const origin = options.origin || aiPayload.origin || "ai", source_turn_id = options.source_turn_id || aiPayload.source_turn_id;
    if (origin !== "ai") throw fail("This proposal boundary only accepts AI-originated change sets");
    if (!nonEmpty(source_turn_id)) throw fail("AI change sets require source_turn_id"); await sourceTurn(client, projectId, source_turn_id);
    if (Array.isArray(aiPayload.items)) {
      // The compact items form is reserved for trusted internal callers and
      // is never accepted from the public cofounder-output boundary.
      if (options.internal !== true) throw fail("Custom change-set items are internal-only; submit the Phase 1 cofounder output envelope");
    } else {
      try { validateCofounderOutput(aiPayload); } catch (error) { throw fail(`Invalid cofounder output: ${error.message}`); }
    }
    const rawItems = normalizedItems(aiPayload, options.include_recommendation !== false); if (!rawItems.length || rawItems.length > MAX_ITEMS) throw fail("Change set must contain a bounded number of items");
    const top = await currentTopIssue(client, projectId), items = [];
    for (const item of rawItems) items.push(await validateItem(client, projectId, item, top));
    const idempotencyKey = options.idempotency_key || aiPayload.idempotency_key;
    if (!nonEmpty(idempotencyKey) || idempotencyKey.length > 200) throw fail("Change set requires a bounded idempotency_key");
    const existing = await client.query("SELECT * FROM change_sets WHERE project_id=$1 AND idempotency_key=$2", [projectId, idempotencyKey]); if (existing.rowCount) return { ...existing.rows[0], items: (await client.query("SELECT * FROM change_set_items WHERE change_set_id=$1 ORDER BY sequence_number", [existing.rows[0].id])).rows, reused: true };
    const set = (await client.query("INSERT INTO change_sets (project_id,source_turn_id,origin,rationale,proposal_metadata,idempotency_key,expires_at) VALUES ($1,$2,'ai',$3,$4,$5,$6) RETURNING *", [projectId, source_turn_id, aiPayload.rationale || null, options.proposal_metadata || aiPayload.proposal_metadata || {}, idempotencyKey, options.expires_at || aiPayload.expires_at || null])).rows[0];
    const rows = [];
    for (let i = 0; i < items.length; i++) rows.push((await client.query("INSERT INTO change_set_items (change_set_id,sequence_number,record_type,operation,target_entity_id,original_payload,current_payload) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *", [set.id, i + 1, items[i].record_type, items[i].operation, items[i].target_entity_id, items[i].payload])).rows[0]);
    await audit(client, projectId, "ai", "ai", "proposed", "change_set", set.id, { source_turn_id, item_count: rows.length });
    return { ...set, items: rows, reused: false };
  });
}

async function withSet(client, projectId, changeSetId, lock = true) { const result = await client.query(`SELECT * FROM change_sets WHERE id=$1 AND project_id=$2${lock ? " FOR UPDATE" : ""}`, [changeSetId, projectId]); if (!result.rowCount) throw fail("Change set not found for project"); return result.rows[0]; }
function reviewable(set) { if (!["pending_review", "partially_approved", "approved"].includes(set.status) || (set.expires_at && new Date(set.expires_at) <= new Date())) throw fail("Change set is not reviewable"); }
async function approveChangeSet(projectId, changeSetId, context = {}) { const actor = await auth(query, projectId, context); return transaction(async client => { const set = await withSet(client, projectId, changeSetId); reviewable(set); await client.query("UPDATE change_set_items SET review_status='approved', reviewed_at=now(), reviewed_by=$2 WHERE change_set_id=$1 AND review_status='pending'", [set.id, actor]); const updated = (await client.query("UPDATE change_sets SET status='approved',approved_at=now(),approved_by=$2 WHERE id=$1 RETURNING *", [set.id, actor])).rows[0]; await audit(client, projectId, "founder", actor, "approved", "change_set", set.id, { all: true }); return updated; }); }
async function approveChangeSetItems(projectId, changeSetId, itemIds, context = {}) { const actor = await auth(query, projectId, context); if (!Array.isArray(itemIds) || !itemIds.length) throw fail("Select one or more change-set items"); return transaction(async client => { const set = await withSet(client, projectId, changeSetId); reviewable(set); const items = (await client.query("SELECT * FROM change_set_items WHERE change_set_id=$1 FOR UPDATE", [set.id])).rows; const selected = new Set(itemIds); if (items.some(item => selected.has(item.id) && item.review_status !== "pending")) throw fail("Only pending items can be approved"); if (items.filter(item => selected.has(item.id)).length !== selected.size) throw fail("Selected item does not belong to change set"); await client.query("UPDATE change_set_items SET review_status='approved',reviewed_at=now(),reviewed_by=$2 WHERE change_set_id=$1 AND id = ANY($3::uuid[])", [set.id, actor, itemIds]); const allApproved = items.every(item => selected.has(item.id) || item.review_status === "approved"); const status = allApproved ? "approved" : "partially_approved"; const updated = (await client.query("UPDATE change_sets SET status=$2,approved_at=COALESCE(approved_at,now()),approved_by=COALESCE(approved_by,$3) WHERE id=$1 RETURNING *", [set.id, status, actor])).rows[0]; await audit(client, projectId, "founder", actor, "approved_selected", "change_set", set.id, { item_ids: itemIds }); return updated; }); }
async function rejectChangeSet(projectId, changeSetId, context = {}, reason = null) { const actor = await auth(query, projectId, context); return transaction(async client => { const set = await withSet(client, projectId, changeSetId); reviewable(set); await client.query("UPDATE change_set_items SET review_status='rejected',reviewed_at=now(),reviewed_by=$2,rejection_reason=$3 WHERE change_set_id=$1 AND review_status IN ('pending','approved')", [set.id, actor, reason]); const updated = (await client.query("UPDATE change_sets SET status='rejected',rejected_at=now(),rejected_by=$2,rejection_reason=$3 WHERE id=$1 RETURNING *", [set.id, actor, reason])).rows[0]; await audit(client, projectId, "founder", actor, "rejected", "change_set", set.id, { reason }); return updated; }); }
async function editChangeSetItem(projectId, changeSetId, itemId, payload, context = {}) { const actor = await auth(query, projectId, context); return transaction(async client => { const set = await withSet(client, projectId, changeSetId); reviewable(set); const current = await client.query("SELECT * FROM change_set_items WHERE id=$1 AND change_set_id=$2 FOR UPDATE", [itemId, set.id]); if (!current.rowCount || current.rows[0].review_status !== "pending") throw fail("Only pending change-set items can be edited"); const top = await currentTopIssue(client, projectId), checked = await validateItem(client, projectId, { record_type: current.rows[0].record_type, operation: current.rows[0].operation, target_entity_id: current.rows[0].target_entity_id, payload }, top); const row = (await client.query("UPDATE change_set_items SET current_payload=$2,revision_metadata=revision_metadata || $3::jsonb,validation_status='valid',validation_errors='[]'::jsonb WHERE id=$1 RETURNING *", [itemId, checked.payload, JSON.stringify({ edited_by: actor, edited_at: new Date().toISOString() })])).rows[0]; await audit(client, projectId, "founder", actor, "edited", "change_set_item", itemId, { change_set_id: set.id }); return row; }); }
async function getPendingChangeSetsForProject(projectId, context = {}) { await auth(query, projectId, context); const sets = (await query("SELECT * FROM change_sets WHERE project_id=$1 AND status IN ('pending_review','partially_approved') ORDER BY created_at DESC", [projectId])).rows; for (const set of sets) set.items = (await query("SELECT * FROM change_set_items WHERE change_set_id=$1 ORDER BY sequence_number", [set.id])).rows; return sets; }

function insertColumns(type, payload) { const skip = new Set(["source_ids", "provenance", "evidence_links", "top_unresolved_issue_id", "justification"]); const columns = Object.keys(payload).filter(key => !skip.has(key)); return { columns, values: columns.map(key => payload[key]) }; }
async function applyItem(client, projectId, item, actor, sourceTurnId) {
  const payload = item.current_payload, type = item.record_type;
  if (type === "belief") {
    let beliefId = item.target_entity_id;
    let version;
    const provenance = { ...(payload.provenance || {}), change_set_item_id: item.id };
    if (item.operation === "create") {
      beliefId = (await client.query("INSERT INTO beliefs (project_id) VALUES ($1) RETURNING id", [projectId])).rows[0].id;
      version = (await client.query("INSERT INTO belief_versions (belief_id,version_number,statement,classification,validation_status,confidence,importance,scope,rationale,source_turn_id,source_user_id,source_assumption_id,source_identifier,provenance) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'approved_change_set',$12) RETURNING *", [beliefId, payload.statement, payload.classification, payload.validation_status || "proposed", payload.confidence || null, payload.importance || null, payload.scope || {}, payload.rationale || null, sourceTurnId, actor, payload.source_assumption_id || null, provenance])).rows[0];
      await client.query("UPDATE beliefs SET current_version_id=$1 WHERE id=$2", [version.id, beliefId]);
    } else version = await appendBeliefVersion(client, beliefId, { ...payload, source_turn_id: sourceTurnId, source_user_id: actor, source_identifier: "approved_change_set", provenance });
    for (const link of payload.evidence_links || []) await linkEvidenceToBeliefVersion(client, version.id, link.source_id, { relationship: link.relationship, explanation: link.explanation, provenance: { change_set_item_id: item.id } });
    return { entity_id: beliefId, belief_version_id: version.id };
  }
  if (type === "recommendation") {
    // Use the same project lock and replacement sequence as the regular
    // recommender so reviewed recommendations retain one-current/history
    // guarantees instead of bypassing the normalized persistence contract.
    await client.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [projectId]);
    const previous = (await client.query("SELECT id, version FROM recommendations WHERE project_id=$1 AND status='active' FOR UPDATE", [projectId])).rows[0] || null;
    if (previous) await client.query("UPDATE recommendations SET status='superseded' WHERE id=$1", [previous.id]);
    const row = (await client.query("INSERT INTO recommendations (project_id,recommendation,primary_issue_text,state,source_context,version,supersedes_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING id", [projectId, payload, payload.primary_issue, payload.state, { approved_change_set: true, source_ids: payload.source_ids }, previous ? Number(previous.version) + 1 : 1, previous?.id || null])).rows[0];
    return { entity_id: row.id };
  }
  if (item.operation === "link") throw fail("Link operations are only supported for beliefs");
  const { columns, values } = insertColumns(type, payload);
  if (item.operation === "create") { const fields = ["project_id", ...columns], params = [projectId, ...values]; const row = (await client.query(`INSERT INTO ${tableFor[type]} (${fields.join(",")}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, params)).rows[0]; return { entity_id: row.id }; }
  const allowed = columns.filter(column => editable[type].has(column)); if (!allowed.length) throw fail("Update has no writable fields"); const row = (await client.query(`UPDATE ${tableFor[type]} SET ${allowed.map((column, i) => `${column}=$${i + 1}`).join(",")} WHERE id=$${allowed.length + 1} AND project_id=$${allowed.length + 2} RETURNING id`, [...allowed.map(column => payload[column]), item.target_entity_id, projectId])).rows[0]; if (!row) throw fail("Target entity not found during apply"); return { entity_id: row.id };
}
async function applyApprovedChangeSet(projectId, changeSetId, context = {}) {
  const actor = await auth(query, projectId, context);
  try {
    return await transaction(async client => { const set = await withSet(client, projectId, changeSetId); if (set.status === "applied") return { ...set, idempotent: true }; if (set.status !== "approved" || (set.expires_at && new Date(set.expires_at) <= new Date())) throw fail("Change set is not approved for application"); const items = (await client.query("SELECT * FROM change_set_items WHERE change_set_id=$1 ORDER BY sequence_number FOR UPDATE", [set.id])).rows.filter(item => item.review_status === "approved"); if (!items.length) throw fail("Change set has no approved items"); await client.query("UPDATE change_sets SET status='applying' WHERE id=$1", [set.id]); for (const item of items) { const result = await applyItem(client, projectId, item, actor, set.source_turn_id); await client.query("UPDATE change_set_items SET review_status='applied',application_result_metadata=$2 WHERE id=$1 RETURNING *", [item.id, result]); const eventId = await audit(client, projectId, "founder", actor, "applied", item.record_type, result.entity_id, { change_set_id: set.id, item_id: item.id, operation: item.operation, before: item.operation === "create" ? null : item.original_payload, after: item.current_payload }); if (result.belief_version_id) await client.query("UPDATE belief_versions SET source_event_id=$1,source_user_id=$2 WHERE id=$3", [eventId, actor, result.belief_version_id]); }
      const applied = (await client.query("UPDATE change_sets SET status='applied',applied_at=now(),applied_by=$2,application_metadata=$3 WHERE id=$1 RETURNING *", [set.id, actor, { applied_item_count: items.length, applied_record_types: [...new Set(items.map(item => item.record_type))] }])).rows[0]; await audit(client, projectId, "founder", actor, "applied", "change_set", set.id, { item_count: items.length }); return { ...applied, idempotent: false }; });
  } catch (error) {
    // The application transaction has rolled back, so no item or entity write
    // survives. Persist the failure state and its audit event together in a
    // separate transaction; this deliberately leaves the rollback guarantee
    // for the attempted application untouched.
    if (error.code !== "INVALID_CHANGE_SET") {
      await transaction(async client => {
        const failed = await client.query("UPDATE change_sets SET status='failed', application_metadata=application_metadata || $2::jsonb WHERE id=$1 AND project_id=$3 AND status IN ('approved','applying') RETURNING *", [changeSetId, JSON.stringify({ error: error.message }), projectId]);
        if (failed.rowCount) await audit(client, projectId, "founder", actor, "failed", "change_set", changeSetId, { error: error.message });
      });
    }
    throw error;
  }
}

module.exports = { proposeChangeSet, approveChangeSet, approveChangeSetItems, rejectChangeSet, editChangeSetItem, getPendingChangeSetsForProject, applyApprovedChangeSet, validateItem, MAX_ITEMS, MAX_PAYLOAD_BYTES };
