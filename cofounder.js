"use strict";

// Phase 6 deliberately orchestrates existing boundaries.  It does not write
// memory entities: material proposals are handed to Phase 5 for review.
const crypto = require("crypto");
const { query, transaction } = require("./db");
const { buildContextPacket } = require("./context");
const { persistRecommendation } = require("./recommendations");
const { validateCofounderOutput, validateDeterministicRecommendationContext } = require("./ai_cofounder_contract");
const { proposeChangeSet } = require("./change_sets");
const { cofounderOutputSchema } = require("./ai_cofounder_contract");

const OPENAI_URL = "https://api.openai.com/v1/responses";
const promptVersion = "phase-6-openai-v1";
const model = process.env.COFOUNDER_MODEL || process.env.OPENAI_MODEL || "gpt-5.5";
const timeoutMs = Number(process.env.COFOUNDER_TIMEOUT_MS) || 90_000;
const safeMessage = "I saved your message, but I could not produce a validated cofounder response. Please try again.";
const openAICofounderSchema = JSON.parse(JSON.stringify(cofounderOutputSchema));
// Strict Structured Outputs requires every declared property to be required.
openAICofounderSchema.properties.proposed_belief_updates.items.required.push("evidence_links");

const cofounderInstructions = `You are an AI cofounder helping a founder reach first revenue.

Use only the supplied project context and the founder's latest message. Do not invent market facts, customer evidence, prices, or outcomes. Ask at most one focused question at a time. Prefer observable behavior and payment evidence over opinions. Treat founder statements as unverified unless the founder explicitly reports an observed result. The deterministic recommendation in the context is authoritative for priority and state; explain it clearly and provide a concrete action_payload when useful.

Return only the supplied JSON schema. Propose material memory updates instead of claiming that you wrote them. Every proposal must include source_ids. Use the provided context_packet_id and founder_turn_id as provenance for proposals; evidence_links may additionally reference evidence IDs present in the context. Set needs_founder_review true whenever you propose a belief or record update. Keep the assistant_message concise, founder-facing, and specific.`;

function responseText(result) {
  if (typeof result?.output_text === "string") return result.output_text;
  return result?.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "";
}

async function callOpenAIModel({ contextPacket, founderTurn }) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error("OPENAI_API_KEY is not configured."), { status: 503 });
  const requestId = `cofounder-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "X-Client-Request-Id": requestId },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 2_000,
        text: { verbosity: "low", format: { type: "json_schema", name: "cofounder_output", strict: true, schema: openAICofounderSchema } },
        input: [
          { role: "system", content: [{ type: "input_text", text: cofounderInstructions }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify({ context_packet_id: contextPacket.id, founder_turn_id: founderTurn.id, context: contextPacket.data, founder_message: founderTurn.content }) }] }
        ]
      })
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const detail = payload?.error?.message || `OpenAI returned HTTP ${response.status}`;
      throw Object.assign(new Error(detail), { status: response.status >= 500 ? 502 : response.status, openaiCode: payload?.error?.code });
    }
    const raw = JSON.parse(responseText(payload) || "{}");
    return { ...raw, model: payload.model || model, prompt_version: promptVersion };
  } catch (error) {
    if (controller.signal.aborted) throw Object.assign(new Error("The cofounder response took too long. Please try again."), { status: 504, cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// This is intentionally local and deterministic.  A caller must inject a
// model seam to get a substantive response; Phase 6 never makes a live call.
async function callCofounderModel({ contextPacket, founderTurn }) {
  const recommendation = contextPacket.data?.deterministic_recommendation || { state: "question", primary_issue: "The next validation detail is unclear", reason: "A specific result or blocker is needed to choose the next action.", action_payload: {}, confidence: 1, source_ids: [] };
  return {
    assistant_message: `I saved your update. ${recommendation.reason}`,
    proposed_belief_updates: [],
    proposed_records: [],
    recommendation: { ...recommendation, source_ids: [contextPacket.id, founderTurn.id] },
    needs_founder_review: true,
    model: "local-phase-6", prompt_version: promptVersion
  };
}

async function fullMemory(projectId, executor) {
  const run = executor.query.bind(executor);
  const project = await run("SELECT * FROM projects WHERE id=$1", [projectId]);
  const assumptions = await run("SELECT * FROM assumptions WHERE project_id=$1 ORDER BY risk_score DESC, created_at", [projectId]);
  const evidence = await run("SELECT * FROM evidence WHERE project_id=$1 ORDER BY created_at DESC", [projectId]);
  const experiments = await run("SELECT * FROM experiments WHERE project_id=$1 ORDER BY created_at DESC", [projectId]);
  const tasks = await run("SELECT * FROM tasks WHERE project_id=$1 ORDER BY created_at", [projectId]);
  const decisions = await run("SELECT * FROM decisions WHERE project_id=$1 ORDER BY created_at DESC", [projectId]);
  const links = await run("SELECT ae.* FROM assumption_evidence ae JOIN evidence e ON e.id=ae.evidence_id WHERE e.project_id=$1", [projectId]);
  const recommendation = await run("SELECT id, context_packet_id, recommendation, created_at FROM recommendations WHERE project_id=$1 AND status='active' ORDER BY created_at DESC, id DESC LIMIT 1", [projectId]);
  const turns = await run("SELECT id, session_id, turn_no, actor_type, content, created_at FROM conversation_turns WHERE project_id=$1 ORDER BY created_at DESC, turn_no DESC, id DESC LIMIT 20", [projectId]);
  return { project: project.rows[0], assumptions: assumptions.rows, evidence: evidence.rows, experiments: experiments.rows, tasks: tasks.rows, decisions: decisions.rows, assumption_evidence: links.rows, latest_recommendation: recommendation.rows[0] || null, conversation_turns: turns.rows };
}

function modelError(code, error) {
  return { code, message: safeMessage, detail: error?.message || "Cofounder response unavailable" };
}

function normalizeCofounderOutput(raw, contextPacket, founderTurn, plan = null) {
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
  // The model may shape wording/action only. Ranking, selected issue, and
  // state are deterministic policy and cannot be redirected by model output.
  const deterministic = plan?.recommendation || contextPacket.data?.deterministic_recommendation;
  if (deterministic) {
    validateDeterministicRecommendationContext(deterministic);
    normalized.recommendation = {
      state: deterministic.state,
      primary_issue: deterministic.primary_issue,
      reason: normalized.recommendation.reason,
      action_payload: normalized.recommendation.action_payload,
      confidence: deterministic.confidence,
      source_ids: deterministic.source_ids
    };
  }
  return normalized;
}

async function persistConversationTurn(projectId, message, userId = null) {
  return transaction(async client => {
    let session = (await client.query("SELECT id FROM conversation_sessions WHERE project_id=$1 AND status='open' ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [projectId])).rows[0];
    if (!session) session = (await client.query("INSERT INTO conversation_sessions (project_id,initiated_by) VALUES ($1,'founder') RETURNING id", [projectId])).rows[0];
    const packet = buildContextPacket(await fullMemory(projectId, client));
    const contextPacket = (await client.query("INSERT INTO context_packets (project_id,purpose,data,included_memory_record_ids) VALUES ($1,'chat_turn',$2,$3) RETURNING *", [projectId, packet.data, packet.included_memory_record_ids])).rows[0];
    const turnNo = (await client.query("SELECT COALESCE(MAX(turn_no),0)+1 AS turn_no FROM conversation_turns WHERE session_id=$1", [session.id])).rows[0].turn_no;
    const founderTurn = (await client.query("INSERT INTO conversation_turns (session_id,project_id,context_packet_id,turn_no,actor_type,content) VALUES ($1,$2,$3,$4,'founder',$5) RETURNING *", [session.id, projectId, contextPacket.id, turnNo, message])).rows[0];
    await client.query("INSERT INTO event_log (project_id,actor_type,actor_id,event_type,entity_type,entity_id,summary,payload) VALUES ($1,'founder',$2,'created','conversation_turn',$3,$4,$5)", [projectId, userId, founderTurn.id, "Saved founder chat turn", { context_packet_id: contextPacket.id, turn_no: founderTurn.turn_no }]);
    return { contextPacket, founderTurn, sessionId: session.id, nextTurn: Number(turnNo) + 1 };
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function proposalIdentity(output) {
  const stripVolatileProvenance = value => {
    if (Array.isArray(value)) return value.map(stripVolatileProvenance);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "source_ids").map(([key, item]) => [key, stripVolatileProvenance(item)]));
    return value;
  };
  return stripVolatileProvenance(output);
}

function idempotencyKey(projectId, output, contextPacket, founderTurn, retryKey = null) {
  // The model proposal, not a newly-created assistant turn, is the stable
  // retry identity. A client-supplied retry key preserves idempotency across
  // repeated HTTP attempts that necessarily create fresh persisted chat turns.
  const identity = retryKey ? { projectId, retry_key: retryKey, output: proposalIdentity(output) } : { projectId, context_packet_id: contextPacket.id, founder_turn_id: founderTurn.id, output };
  return `phase6:${crypto.createHash("sha256").update(stableJson(identity)).digest("hex")}`;
}

async function persistAssistantResponse(projectId, saved, output, userId, plan) {
  return transaction(async client => {
    const assistantTurn = (await client.query("INSERT INTO conversation_turns (session_id,project_id,context_packet_id,turn_no,actor_type,content,model,prompt_version,structured_payload) VALUES ($1,$2,$3,$4,'ai',$5,$6,$7,$8) RETURNING *", [saved.sessionId, projectId, saved.contextPacket.id, saved.nextTurn, output.assistant_message, output.model, output.prompt_version, output])).rows[0];
    await client.query("INSERT INTO event_log (project_id,actor_type,actor_id,event_type,entity_type,entity_id,summary,payload) VALUES ($1,'ai',$2,'created','conversation_turn',$3,$4,$5)", [projectId, userId, assistantTurn.id, "Saved AI chat turn", { context_packet_id: saved.contextPacket.id, turn_no: assistantTurn.turn_no, model: output.model, prompt_version: output.prompt_version }]);
    const recommendation = await persistRecommendation(client, projectId, saved.contextPacket, plan, output.recommendation);
    return { assistantTurn, recommendation };
  });
}

async function handleFounderMessage(projectId, userId, message, options = {}) {
  if (typeof message !== "string" || !message.trim()) throw Object.assign(new Error("Chat message is required"), { status: 422 });
  const saved = await persistConversationTurn(projectId, message.trim(), userId);
  // The full ranking is persisted in the context packet, and its deterministic
  // result is the canonical recommendation source for this chat turn.
  const plan = {
    recommendation: { ...saved.contextPacket.data.deterministic_recommendation, issue: saved.contextPacket.data.top_unresolved_issue || null },
    ranked_issues: saved.contextPacket.data.ranked_unresolved_issues || [],
    selected_issue: saved.contextPacket.data.top_unresolved_issue || null
  };
  let raw, fallbackError = null;
  try {
    raw = await (options.callCofounderModel || callCofounderModel)({ projectId, userId, message: saved.founderTurn.content, contextPacket: saved.contextPacket, founderTurn: saved.founderTurn });
  } catch (error) {
    fallbackError = modelError("model_failure", error);
    raw = { assistant_message: safeMessage, proposed_belief_updates: [], proposed_records: [], recommendation: saved.contextPacket.data.deterministic_recommendation, needs_founder_review: false, model: "deterministic-fallback", prompt_version: promptVersion };
  }
  let output;
  try {
    output = normalizeCofounderOutput(raw, saved.contextPacket, saved.founderTurn, plan);
  } catch (error) {
    fallbackError = modelError("invalid_model_output", error);
    output = { assistant_message: safeMessage, proposed_belief_updates: [], proposed_records: [], recommendation: saved.contextPacket.data.deterministic_recommendation, needs_founder_review: false, model: "deterministic-fallback", prompt_version: promptVersion };
    output = normalizeCofounderOutput(output, saved.contextPacket, saved.founderTurn, plan);
  }
  output = output || normalizeCofounderOutput(raw, saved.contextPacket, saved.founderTurn, plan);
  const persisted = await persistAssistantResponse(projectId, saved, output, userId, plan);
  const result = { founder_turn: saved.founderTurn, assistant_turn: persisted.assistantTurn, context_packet: saved.contextPacket, recommendation: persisted.recommendation, ...(fallbackError ? { error: fallbackError } : {}) };
  // A recommendation is persisted as conversation state; only proposed memory
  // updates cross the Phase 5 review boundary.
  const hasMaterialProposal = output.proposed_belief_updates.length || output.proposed_records.length;
  if (!hasMaterialProposal) return result;
  try {
    // The no-unresolved-issue wait state has no source record by design. The
    // persisted recommendation keeps source_ids empty, while the material
    // proposal envelope still needs chat provenance for its own validation.
    const proposalOutput = output.recommendation.source_ids.length ? output : {
      ...output,
      recommendation: { ...output.recommendation, source_ids: [saved.contextPacket.id, persisted.assistantTurn.id] }
    };
    result.change_set = await (options.proposeChangeSet || proposeChangeSet)(projectId, proposalOutput, {
      source_turn_id: persisted.assistantTurn.id,
      idempotency_key: idempotencyKey(projectId, output, saved.contextPacket, saved.founderTurn, options.idempotencyKey || options.idempotency_key || options.clientRequestId || options.client_request_id),
      include_recommendation: false,
      proposal_metadata: { phase: 6, source_turn_id: persisted.assistantTurn.id, context_packet_id: saved.contextPacket.id, provenance: { founder_turn_id: saved.founderTurn.id, assistant_turn_id: persisted.assistantTurn.id } }
    });
  } catch (error) {
    result.proposal_error = { code: error.code || "CHANGE_SET_VALIDATION_FAILED", message: "The response was saved, but its proposed updates need correction before review.", detail: error.message };
  }
  return result;
}

module.exports = { handleFounderMessage, callCofounderModel, callOpenAIModel, normalizeCofounderOutput, persistConversationTurn, idempotencyKey, fullMemory };
