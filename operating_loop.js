"use strict";

const { query, transaction } = require("./db");
const { buildPlanItems } = require("./cofounder_planner");
const { buildContextPacket } = require("./context");

async function enqueueJob(projectId, jobType, payload, idempotencyKey, client = null) {
  const work = async executor => (await executor.query(
    `INSERT INTO background_jobs (project_id,job_type,payload,idempotency_key)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (project_id,job_type,idempotency_key) DO UPDATE SET updated_at=now()
     RETURNING *`, [projectId, jobType, payload || {}, idempotencyKey]
  )).rows[0];
  return client ? work(client) : transaction(work);
}

async function replacePlan(client, projectId, sessionId, memory, { sourceTurnId = null, sourceIds = [], message = "" } = {}) {
  await client.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [projectId]);
  const prior = (await client.query("SELECT id, version FROM cofounder_plans WHERE project_id=$1 AND status='active' FOR UPDATE", [projectId])).rows[0] || null;
  const version = Number(prior?.version || 0) + 1;
  if (prior) await client.query("UPDATE cofounder_plans SET status='superseded' WHERE id=$1", [prior.id]);
  const planned = buildPlanItems(memory, { sourceIds, message });
  const plan = (await client.query(
    `INSERT INTO cofounder_plans (project_id,session_id,version,mode,source_turn_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [projectId, sessionId, version, planned.mode, sourceTurnId]
  )).rows[0];
  for (const [index, item] of planned.items.entries()) {
    await client.query(
      `INSERT INTO cofounder_plan_items
       (plan_id,project_id,sequence_number,intent,response_type,prompt,aspects,trigger,source_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [plan.id, projectId, index + 1, item.intent, item.response_type, item.prompt, JSON.stringify(item.aspects || []), JSON.stringify(item.trigger || {}), JSON.stringify(item.source_ids || [])]
    );
  }
  return { ...plan, items: planned.items };
}

async function activePlan(projectId, executor = { query }) {
  const plan = (await executor.query(
    "SELECT * FROM cofounder_plans WHERE project_id=$1 AND status='active' ORDER BY version DESC LIMIT 1", [projectId]
  )).rows[0] || null;
  if (!plan) return null;
  const items = (await executor.query(
    "SELECT * FROM cofounder_plan_items WHERE plan_id=$1 ORDER BY sequence_number", [plan.id]
  )).rows;
  return { ...plan, items };
}

async function pendingPlanItems(projectId, executor = { query }) {
  const plan = await activePlan(projectId, executor);
  return plan ? plan.items.filter(item => item.status === "pending") : [];
}

async function markPlanItems(client, itemIds, status, turnId = null) {
  if (!Array.isArray(itemIds) || !itemIds.length) return;
  await client.query(
    `UPDATE cofounder_plan_items
     SET status=$1, consumed_by_turn_id=COALESCE($3, consumed_by_turn_id)
     WHERE id = ANY($2::uuid[]) AND status='pending'`, [status, itemIds, turnId]
  );
}

async function ensurePlan(projectId, sessionId = null, { sourceTurnId = null, sourceIds = [], message = "" } = {}) {
  return transaction(async client => {
    const { fullMemory } = require("./cofounder");
    const memory = await fullMemory(projectId, client);
    return replacePlan(client, projectId, sessionId, memory, { sourceTurnId, sourceIds, message });
  });
}

async function listMemoryItems(projectId, { aspect = null, confidence = null } = {}) {
  const filters = [projectId];
  const clauses = ["project_id=$1", "status='current'"];
  if (aspect) { filters.push(aspect); clauses.push(`aspect=$${filters.length}`); }
  if (confidence) { filters.push(confidence); clauses.push(`confidence=$${filters.length}`); }
  return (await query(`SELECT * FROM memory_items WHERE ${clauses.join(" AND ")} ORDER BY aspect, created_at DESC`, filters)).rows;
}

async function saveMemoryItems(client, items) {
  for (const item of items || []) {
    if (!item.statement || !item.aspect) continue;
    const prior = (await client.query(
      "SELECT id FROM memory_items WHERE project_id=$1 AND aspect=$2 AND status='current' AND statement=$3 LIMIT 1",
      [item.project_id, item.aspect, item.statement]
    )).rows[0];
    if (prior) continue;
    await client.query(
      `INSERT INTO memory_items
       (project_id,aspect,statement,value,classification,confidence,evidence_status,review_state,source_turn_ids,source_document_ids,related_entity_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [item.project_id, item.aspect, item.statement, JSON.stringify(item.value || {}), item.classification, item.confidence,
        item.evidence_status || "unverified", item.review_state || "working", JSON.stringify(item.source_turn_ids || []),
        JSON.stringify(item.source_document_ids || []), JSON.stringify(item.related_entity_ids || {})]
    );
  }
}

async function processOneJob({ extractor, proposer } = {}) {
  const claimed = await transaction(async client => {
    const row = (await client.query(
      `SELECT * FROM background_jobs
       WHERE (status='queued' AND available_at <= now())
          OR (status='running' AND locked_at < now() - interval '5 minutes')
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED LIMIT 1`
    )).rows[0];
    if (!row) return null;
    return (await client.query(
      "UPDATE background_jobs SET status='running', attempts=attempts+1, locked_at=now() WHERE id=$1 RETURNING *", [row.id]
    )).rows[0];
  });
  if (!claimed) return false;
  try {
    if (claimed.job_type === "turn_enrichment") {
      const { handleEnrichmentJob } = require("./cofounder");
      await handleEnrichmentJob(claimed.payload, { extractor, proposer });
    }
    await query("UPDATE background_jobs SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1", [claimed.id]);
  } catch (error) {
    const retryable = Number(claimed.attempts) < 3;
    await query(
      `UPDATE background_jobs SET status=$2, available_at=now()+($3 || ' seconds')::interval,
       last_error=$4, updated_at=now() WHERE id=$1`,
      [claimed.id, retryable ? "queued" : "failed", Math.min(300, 2 ** Number(claimed.attempts) * 5), error.message]
    );
  }
  return true;
}

async function drainJobs(options = {}, limit = 5) {
  let count = 0;
  while (count < limit && await processOneJob(options)) count++;
  return count;
}

module.exports = {
  enqueueJob,
  replacePlan,
  activePlan,
  pendingPlanItems,
  markPlanItems,
  ensurePlan,
  listMemoryItems,
  saveMemoryItems,
  processOneJob,
  drainJobs,
  buildContextPacket
};
