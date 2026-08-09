"use strict";

const { transaction } = require("./db");
const { buildContextPacket } = require("./context");
const { planRecommendation } = require("./recommendation_planner");

async function persistRecommendation(client, projectId, packet, plan, shaping = {}) {
  // Project-row locking serializes replacement, preserving one current row and
  // a linear immutable history even under concurrent API requests.
  await client.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [projectId]);
  const previous = (await client.query("SELECT id, version FROM recommendations WHERE project_id=$1 AND status='active' FOR UPDATE", [projectId])).rows[0] || null;
  const version = previous ? Number(previous.version) + 1 : 1;
  const deterministic = plan.recommendation;
  const recommendation = {
    state: deterministic.state,
    primary_issue: deterministic.primary_issue,
    reason: typeof shaping.reason === "string" && shaping.reason.trim() ? shaping.reason.trim() : deterministic.reason,
    action_payload: shaping.action_payload && typeof shaping.action_payload === "object" && !Array.isArray(shaping.action_payload) ? shaping.action_payload : deterministic.action_payload,
    confidence: deterministic.confidence,
    source_ids: deterministic.source_ids
  };
  if (previous) await client.query("UPDATE recommendations SET status='superseded' WHERE id=$1", [previous.id]);
  return (await client.query(
    "INSERT INTO recommendations (project_id,context_packet_id,recommendation,primary_issue_id,primary_issue_text,state,source_context,version,supersedes_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,project_id,context_packet_id,recommendation,primary_issue_id,primary_issue_text,state,source_context,version,supersedes_id,status,created_at",
    [projectId, packet.id, recommendation, deterministic.issue?.assumption_id || null, deterministic.primary_issue, deterministic.state, { packet: packet.data, included_memory_record_ids: packet.included_memory_record_ids, ranked_issues: plan.ranked_issues, rule: deterministic.rule }, version, previous?.id || null]
  )).rows[0];
}

async function recalculateRecommendation(projectId, { client = null, memory = null, shaping = {}, purpose = "recommendation_recalculation" } = {}) {
  const work = async executor => {
    const { fullMemory } = require("./cofounder");
    const currentMemory = memory || await fullMemory(projectId, executor);
    const packetValue = buildContextPacket(currentMemory);
    const packet = (await executor.query("INSERT INTO context_packets (project_id,purpose,data,included_memory_record_ids) VALUES ($1,$2,$3,$4) RETURNING *", [projectId, purpose, packetValue.data, packetValue.included_memory_record_ids])).rows[0];
    const plan = planRecommendation(currentMemory);
    return persistRecommendation(executor, projectId, packet, plan, shaping);
  };
  return client ? work(client) : transaction(work);
}

async function recommendationHistory(projectId, executor) {
  const run = executor.query.bind(executor);
  return (await run("SELECT id,project_id,context_packet_id,recommendation,primary_issue_id,primary_issue_text,state,source_context,version,supersedes_id,status,created_at FROM recommendations WHERE project_id=$1 ORDER BY version DESC, created_at DESC, id DESC", [projectId])).rows;
}

module.exports = { persistRecommendation, recalculateRecommendation, recommendationHistory };
