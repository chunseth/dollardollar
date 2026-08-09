"use strict";

// Phase 6 deliberately orchestrates existing boundaries.  It does not write
// memory entities: material proposals are handed to Phase 5 for review.
const crypto = require("crypto");
const { query, transaction } = require("./db");
const { buildContextPacket } = require("./context");
const { validateCofounderOutput } = require("./ai_cofounder_contract");
const { proposeChangeSet } = require("./change_sets");

const promptVersion = "phase-6-local-v1";
const safeMessage = "I saved your message, but I could not produce a validated cofounder response. Please try again.";

// This is intentionally local and deterministic.  A caller must inject a
// model seam to get a substantive response; Phase 6 never makes a live call.
async function callCofounderModel({ contextPacket, founderTurn }) {
  return {
    assistant_message: "I saved your update. What is the most important result or blocker to clarify next?",
    proposed_belief_updates: [],
    proposed_records: [],
    recommendation: {
      state: "question",
      primary_issue: "The next validation detail is unclear",
      reason: "A specific result or blocker is needed to choose the next action.",
      action_payload: {}, confidence: 0.2,
      source_ids: [contextPacket.id, founderTurn.id]
    },
    needs_founder_review: true,
    model: "local-phase-6", prompt_version: promptVersion
  };
}

async function fullMemory(projectId, executor) {
  const run = executor.query.bind(executor);
  const [project, assumptions, evidence, experiments, tasks, decisions, links, recommendation, turns] = await Promise.all([
    run("SELECT * FROM projects WHERE id=$1", [projectId]),
    run("SELECT * FROM assumptions WHERE project_id=$1 ORDER BY risk_score DESC, created_at", [projectId]),
    run("SELECT * FROM evidence WHERE project_id=$1 ORDER BY created_at DESC", [projectId]),
    run("SELECT * FROM experiments WHERE project_id=$1 ORDER BY created_at DESC", [projectId]),
    run("SELECT * FROM tasks WHERE project_id=$1 ORDER BY created_at", [projectId]),
    run("SELECT * FROM decisions WHERE project_id=$1 ORDER BY created_at DESC", [projectId]),
    run("SELECT ae.* FROM assumption_evidence ae JOIN evidence e ON e.id=ae.evidence_id WHERE e.project_id=$1", [projectId]),
    run("SELECT id, context_packet_id, recommendation, created_at FROM recommendations WHERE project_id=$1 AND status='active' ORDER BY created_at DESC, id DESC LIMIT 1", [projectId]),
    run("SELECT id, session_id, turn_no, actor_type, content, created_at FROM conversation_turns WHERE project_id=$1 ORDER BY created_at DESC, turn_no DESC, id DESC LIMIT 20", [projectId])
  ]);
  return { project: project.rows[0], assumptions: assumptions.rows, evidence: evidence.rows, experiments: experiments.rows, tasks: tasks.rows, decisions: decisions.rows, assumption_evidence: links.rows, latest_recommendation: recommendation.rows[0] || null, conversation_turns: turns.rows };
}

function modelError(code, error) {
  return { code, message: safeMessage, detail: error?.message || "Cofounder response unavailable" };
}

function normalizeCofounderOutput(raw, contextPacket, founderTurn) {
  // Retain compatibility with the old injected generateAssistant envelope
  // while making the Phase 1 object the only persisted structured payload.
  const output = raw?.structured_payload && raw?.assistant_message && raw?.recommendation ? {
    assistant_message: raw.assistant_message,
    proposed_belief_updates: raw.structured_payload.proposed_belief_updates || [],
    proposed_records: raw.structured_payload.proposed_records || [],
    recommendation: raw.recommendation,
    needs_founder_review: raw.structured_payload.needs_founder_review ?? true,
    model: raw.model, prompt_version: raw.prompt_version
  } : raw;
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error("Cofounder model returned no object output.");
  const normalized = {
    assistant_message: output.assistant_message,
    proposed_belief_updates: output.proposed_belief_updates,
    proposed_records: output.proposed_records,
    recommendation: output.recommendation,
    needs_founder_review: output.needs_founder_review,
    model: typeof output.model === "string" && output.model ? output.model : "injected-cofounder",
    prompt_version: typeof output.prompt_version === "string" && output.prompt_version ? output.prompt_version : promptVersion
  };
  // Source IDs are model output, but ensure every direct proposal carries the
  // persisted chat provenance required by the Phase 5 boundary.
  const provenance = [contextPacket.id, founderTurn.id];
  const attachProvenance = item => {
    if (!item.source_ids) item.source_ids = provenance;
    else if (Array.isArray(item.source_ids)) item.source_ids = [...new Set([...item.source_ids, ...provenance])];
  };
  if (normalized.recommendation) attachProvenance(normalized.recommendation);
  for (const item of normalized.proposed_belief_updates || []) attachProvenance(item);
  for (const item of normalized.proposed_records || []) attachProvenance(item);
  validateCofounderOutput(normalized);
  return normalized;
}

async function persistConversationTurn(projectId, message) {
  return transaction(async client => {
    let session = (await client.query("SELECT id FROM conversation_sessions WHERE project_id=$1 AND status='open' ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [projectId])).rows[0];
    if (!session) session = (await client.query("INSERT INTO conversation_sessions (project_id,initiated_by) VALUES ($1,'founder') RETURNING id", [projectId])).rows[0];
    const packet = buildContextPacket(await fullMemory(projectId, client));
    const contextPacket = (await client.query("INSERT INTO context_packets (project_id,purpose,data,included_memory_record_ids) VALUES ($1,'chat_turn',$2,$3) RETURNING *", [projectId, packet.data, packet.included_memory_record_ids])).rows[0];
    const turnNo = (await client.query("SELECT COALESCE(MAX(turn_no),0)+1 AS turn_no FROM conversation_turns WHERE session_id=$1", [session.id])).rows[0].turn_no;
    const founderTurn = (await client.query("INSERT INTO conversation_turns (session_id,project_id,context_packet_id,turn_no,actor_type,content) VALUES ($1,$2,$3,$4,'founder',$5) RETURNING *", [session.id, projectId, contextPacket.id, turnNo, message])).rows[0];
    return { contextPacket, founderTurn, sessionId: session.id, nextTurn: Number(turnNo) + 1 };
  });
}

function idempotencyKey(projectId, assistantTurn, contextPacket) {
  return `phase6:${crypto.createHash("sha256").update(`${projectId}:${assistantTurn.id}:${contextPacket.id}`).digest("hex")}`;
}

async function persistAssistantResponse(projectId, saved, output) {
  return transaction(async client => {
    const assistantTurn = (await client.query("INSERT INTO conversation_turns (session_id,project_id,context_packet_id,turn_no,actor_type,content,model,prompt_version,structured_payload) VALUES ($1,$2,$3,$4,'ai',$5,$6,$7,$8) RETURNING *", [saved.sessionId, projectId, saved.contextPacket.id, saved.nextTurn, output.assistant_message, output.model, output.prompt_version, output])).rows[0];
    await client.query("UPDATE recommendations SET status='superseded' WHERE project_id=$1 AND status='active'", [projectId]);
    const recommendation = (await client.query("INSERT INTO recommendations (project_id,context_packet_id,recommendation) VALUES ($1,$2,$3) RETURNING id, context_packet_id, recommendation, created_at", [projectId, saved.contextPacket.id, output.recommendation])).rows[0];
    return { assistantTurn, recommendation };
  });
}

async function handleFounderMessage(projectId, userId, message, options = {}) {
  if (typeof message !== "string" || !message.trim()) throw Object.assign(new Error("Chat message is required"), { status: 422 });
  const saved = await persistConversationTurn(projectId, message.trim());
  let output;
  try {
    output = normalizeCofounderOutput(await (options.callCofounderModel || callCofounderModel)({ projectId, userId, message: saved.founderTurn.content, contextPacket: saved.contextPacket, founderTurn: saved.founderTurn }), saved.contextPacket, saved.founderTurn);
  } catch (error) {
    return { founder_turn: saved.founderTurn, assistant_turn: null, context_packet: saved.contextPacket, recommendation: null, error: modelError(error.code === "INVALID_COFUNDER_CONTRACT" ? "invalid_model_output" : "model_failure", error) };
  }
  const persisted = await persistAssistantResponse(projectId, saved, output);
  const result = { founder_turn: saved.founderTurn, assistant_turn: persisted.assistantTurn, context_packet: saved.contextPacket, recommendation: persisted.recommendation };
  // A recommendation is persisted as conversation state; only proposed memory
  // updates cross the Phase 5 review boundary.
  const hasMaterialProposal = output.proposed_belief_updates.length || output.proposed_records.length;
  if (!hasMaterialProposal) return result;
  try {
    result.change_set = await proposeChangeSet(projectId, output, {
      source_turn_id: persisted.assistantTurn.id,
      idempotency_key: idempotencyKey(projectId, persisted.assistantTurn, saved.contextPacket),
      proposal_metadata: { phase: 6, source_turn_id: persisted.assistantTurn.id, context_packet_id: saved.contextPacket.id, provenance: { founder_turn_id: saved.founderTurn.id, assistant_turn_id: persisted.assistantTurn.id } }
    });
  } catch (error) {
    result.proposal_error = { code: error.code || "CHANGE_SET_VALIDATION_FAILED", message: "The response was saved, but its proposed updates need correction before review.", detail: error.message };
  }
  return result;
}

module.exports = { handleFounderMessage, callCofounderModel, normalizeCofounderOutput, persistConversationTurn, idempotencyKey };
