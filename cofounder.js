"use strict";

// Phase 6 deliberately orchestrates existing boundaries.  It does not write
// memory entities: material proposals are handed to Phase 5 for review.
const crypto = require("crypto");
const { query, transaction } = require("./db");
const { buildContextPacket } = require("./context");
const { persistRecommendation } = require("./recommendations");
const { validateCofounderOutput, validateDeterministicRecommendationContext, cofounderOutputSchema } = require("./ai_cofounder_contract");
const { proposeChangeSet } = require("./change_sets");
const { discoveryPlan } = require("./discovery_planner");
const { buildPlanItems, extractWorkingItems } = require("./cofounder_planner");
const { activePlan, enqueueJob, markPlanItems, replacePlan, saveMemoryItems } = require("./operating_loop");

const OPENAI_URL = "https://api.openai.com/v1/responses";
const promptVersion = "phase-6-openai-v1";
const model = process.env.COFOUNDER_MODEL || process.env.OPENAI_MODEL || "gpt-5.5";
const timeoutMs = Number(process.env.COFOUNDER_TIMEOUT_MS) || 90_000;
const safeMessage = "I saved your message, but I could not produce a validated cofounder response. Please try again.";

const fastCofounderInstructions = `You are the same warm AI cofounder, responding in real time. Be genuinely interested in the founder's specific idea. Reflect one compelling detail before moving the conversation forward. Ask at most one focused question. Sound like an excited, perceptive collaborator, never an investor interview or a business intake form.

Use only the supplied context. Do not invent facts, evidence, prices, or outcomes. If the founder already answered a planned question, acknowledge it and move to the next useful thread. You may skip a planned question when the founder's message clearly covers it. Keep the reply to one or two short sentences and no more than 55 words. Do not use labels, bullets, colons, or em dashes. If a naming checkpoint is ready, make it feel like a natural identity moment and invite brainstorming.

Return only the supplied JSON schema. Include the IDs of any plan items you consumed or skipped. Choose one hidden cofounder mode from explorer, synthesizer, constructive_challenger, evidence_interpreter, product_design_partner, execution_coach, or roadmap_planner.`;

const fastCofounderSchema = {
  type: "object", additionalProperties: false,
  required: ["assistant_message", "consumed_plan_item_ids", "skipped_plan_item_ids", "mode"],
  properties: {
    assistant_message: { type: "string" },
    consumed_plan_item_ids: { type: "array", items: { type: "string" } },
    skipped_plan_item_ids: { type: "array", items: { type: "string" } },
    mode: { type: "string", enum: ["explorer", "synthesizer", "constructive_challenger", "evidence_interpreter", "product_design_partner", "execution_coach", "roadmap_planner"] }
  }
};

const cofounderInstructions = `You are an AI cofounder helping a founder reach first revenue. Speak like a thoughtful, friendly mentor—not a generic chatbot or an analyst writing a report.

Use only the supplied project context and the founder's latest message. Do not invent market facts, customer evidence, prices, statistics, or outcomes. Keep the assistant_message to one or two short sentences and no more than 45 words. Ask exactly one natural, focused question when more context is needed. Do not use labels, preambles, bullet points, or phrases such as "unvalidated idea", "current system recommendation", "top unresolved issue", or "one focused question". Avoid using colons and em dashes in the response. Jump directly into a warm reflection or qualifier, then the question.

In early discovery, treat the founder's latest message as the source of truth for what they have already answered. If they already named a customer segment, do not ask who the customer is again; ask about the concrete problem, current workaround, frequency, setting, or first reachable slice. If the idea is vague, ask either for the specific customer or the problem—not both. A short grounded qualifier (for example, naming the tension or uncertainty in the founder's belief) is useful; never manufacture a statistic.

Prefer observable behavior and payment evidence over opinions. Treat founder statements as unverified unless the founder explicitly reports an observed result. The deterministic recommendation in the context is authoritative for priority and state, but never mention that internal recommendation or claim that no issue exists. In discovery mode with no recorded issue, ask the next scoping question directly rather than saying to wait.

Return only the supplied JSON schema. Extract any newly stated or clearly inferred discovery facts into discovery_facts. Use the exact field that best fits each fact, and set confidence to high only when the founder was explicit. Do not repeat unchanged facts. While onboarding_state is discovery, keep proposed_belief_updates and proposed_records empty; discovery_facts are the only working-memory updates. After the snapshot, propose material memory updates instead of claiming that you wrote them. Every proposal must include source_ids. Task and experiment payloads must include either the current top_unresolved_issue_id or a concise justification. Use the provided context_packet_id and founder_turn_id as provenance for proposals; evidence_links may additionally reference evidence IDs present in the context. Set needs_founder_review true whenever you propose a belief or record update. Keep the assistant_message concise, founder-facing, and specific.`;

function responseText(result) {
  if (typeof result?.output_text === "string") return result.output_text;
  return result?.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "";
}

async function callOpenAIModel({ contextPacket, founderTurn, fast = false }) {
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
        max_output_tokens: fast ? 700 : 2_000,
        // The contract deliberately permits extensible action and record
        // payloads. Keep the schema response-formatted, then enforce the
        // complete contract with validateCofounderOutput below.
        text: { verbosity: "low", format: { type: "json_schema", name: fast ? "cofounder_fast_response" : "cofounder_output", strict: false, schema: fast ? fastCofounderSchema : cofounderOutputSchema } },
        input: [
          { role: "system", content: [{ type: "input_text", text: fast ? fastCofounderInstructions : cofounderInstructions }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify({ context_packet_id: contextPacket.id, founder_turn_id: founderTurn.id, context: contextPacket.data, response_plan: contextPacket.data.response_plan || [], founder_message: founderTurn.content }) }] }
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

async function callFastCofounderModel({ contextPacket, founderTurn }) {
  if (!process.env.OPENAI_API_KEY) return callCofounderModel({ contextPacket, founderTurn });
  const raw = await callOpenAIModel({ contextPacket, founderTurn, fast: true });
  const deterministic = contextPacket.data?.deterministic_recommendation || {
    state: "question", primary_issue: "The next useful detail is still taking shape.",
    reason: "Stay curious about the founder's latest detail.", action_payload: {}, confidence: 1, source_ids: [], rule: "discovery_question"
  };
  return {
    assistant_message: raw.assistant_message,
    consumed_plan_item_ids: raw.consumed_plan_item_ids || [],
    skipped_plan_item_ids: raw.skipped_plan_item_ids || [],
    mode: raw.mode || "explorer",
    discovery_facts: [], proposed_belief_updates: [], proposed_records: [],
    recommendation: deterministic, needs_founder_review: false,
    model: raw.model || model, prompt_version: "cofounder-fast-v1"
  };
}

// This is intentionally local and deterministic.  A caller must inject a
// model seam to get a substantive response; Phase 6 never makes a live call.
async function callCofounderModel({ contextPacket, founderTurn }) {
  const recommendation = contextPacket.data?.deterministic_recommendation || { state: "question", primary_issue: "The next validation detail is unclear", reason: "A specific result or blocker is needed to choose the next action.", action_payload: {}, confidence: 1, source_ids: [] };
  const planned = contextPacket.data?.response_plan?.[0] || null;
  return {
    assistant_message: planned?.prompt || `I saved your update. ${recommendation.reason}`,
    consumed_plan_item_ids: planned ? [planned.id] : [],
    skipped_plan_item_ids: [],
    mode: contextPacket.data?.cofounder_mode || "explorer",
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
  const discoveryFacts = await run("SELECT * FROM discovery_facts WHERE project_id=$1 AND status='current' ORDER BY created_at DESC", [projectId]);
  const recommendation = await run("SELECT id, context_packet_id, recommendation, created_at FROM recommendations WHERE project_id=$1 AND status='active' ORDER BY created_at DESC, id DESC LIMIT 1", [projectId]);
  const memoryItems = await run("SELECT * FROM memory_items WHERE project_id=$1 AND status='current' ORDER BY created_at DESC", [projectId]).catch(() => ({ rows: [] }));
  const turns = await run("SELECT id, session_id, turn_no, actor_type, content, created_at FROM conversation_turns WHERE project_id=$1 ORDER BY created_at DESC, turn_no DESC, id DESC LIMIT 20", [projectId]);
  return { project: project.rows[0], assumptions: assumptions.rows, evidence: evidence.rows, experiments: experiments.rows, tasks: tasks.rows, decisions: decisions.rows, assumption_evidence: links.rows, discovery_facts: discoveryFacts.rows, memory_items: memoryItems.rows, latest_recommendation: recommendation.rows[0] || null, conversation_turns: turns.rows };
}

function modelError(code, error) {
  return { code, message: safeMessage, detail: error?.message || "Cofounder response unavailable" };
}

function normalizeCofounderOutput(raw, contextPacket, founderTurn, plan = null) {
  // Retain compatibility with the old injected generateAssistant envelope
  // while making the Phase 1 object the only persisted structured payload.
  const output = raw?.structured_payload && raw?.assistant_message && raw?.recommendation ? {
    assistant_message: raw.assistant_message,
    discovery_facts: raw.structured_payload.discovery_facts || [],
    proposed_belief_updates: raw.structured_payload.proposed_belief_updates || [],
    proposed_records: raw.structured_payload.proposed_records || [],
    recommendation: raw.recommendation,
    needs_founder_review: raw.structured_payload.needs_founder_review ?? true,
    model: raw.model, prompt_version: raw.prompt_version
  } : raw;
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error("Cofounder model returned no object output.");
  const normalized = {
    assistant_message: output.assistant_message,
    discovery_facts: output.discovery_facts || [],
    proposed_belief_updates: (output.proposed_belief_updates || []).map(update => {
      // Discovery metadata such as `field` belongs in discovery_facts. Keep
      // it from crossing into the versioned belief/change-set boundary.
      const allowed = ["statement", "classification", "source_ids", "evidence_links", "confidence", "importance", "validation_status", "scope", "rationale", "provenance", "source_assumption_id", "top_unresolved_issue_id", "justification", "target_entity_id"];
      return Object.fromEntries(Object.entries(update || {}).filter(([key]) => allowed.includes(key)));
    }),
    proposed_records: output.proposed_records,
    recommendation: output.recommendation,
    consumed_plan_item_ids: output.consumed_plan_item_ids || [],
    skipped_plan_item_ids: output.skipped_plan_item_ids || [],
    mode: output.mode || null,
    needs_founder_review: typeof output.needs_founder_review === "boolean" ? output.needs_founder_review : Boolean((output.proposed_belief_updates || []).length || (output.proposed_records || []).length),
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
  for (const item of normalized.discovery_facts || []) attachProvenance(item);
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

async function persistConversationTurn(projectId, message, userId = null, { topic = "general", sessionId = null } = {}) {
  return transaction(async client => {
    let session = sessionId
      ? (await client.query("SELECT * FROM conversation_sessions WHERE id=$1 AND project_id=$2 AND status='open' FOR UPDATE", [sessionId, projectId])).rows[0]
      : (await client.query("SELECT * FROM conversation_sessions WHERE project_id=$1 AND topic=$2 AND status='open' ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [projectId, topic])).rows[0];
    if (!session) session = (await client.query("INSERT INTO conversation_sessions (project_id,initiated_by,topic,title) VALUES ($1,'founder',$2,$3) RETURNING *", [projectId, topic, topic === "general" ? "Cofounder" : topic])).rows[0];
    let responsePlan = await activePlan(projectId, client);
    if (!responsePlan) {
      const memory = await fullMemory(projectId, client);
      responsePlan = await replacePlan(client, projectId, session.id, memory, { message, sourceIds: [] });
    }
    const packet = buildContextPacket(await fullMemory(projectId, client));
    const packetData = { ...packet.data, response_plan: (responsePlan.items || []).filter(item => item.status === "pending").slice(0, 5), cofounder_mode: responsePlan.mode };
    const contextPacket = (await client.query("INSERT INTO context_packets (project_id,purpose,data,included_memory_record_ids) VALUES ($1,'chat_turn',$2,$3) RETURNING *", [projectId, packetData, packet.included_memory_record_ids])).rows[0];
    const turnNo = (await client.query("SELECT COALESCE(MAX(turn_no),0)+1 AS turn_no FROM conversation_turns WHERE session_id=$1", [session.id])).rows[0].turn_no;
    const founderTurn = (await client.query("INSERT INTO conversation_turns (session_id,project_id,context_packet_id,turn_no,actor_type,content) VALUES ($1,$2,$3,$4,'founder',$5) RETURNING *", [session.id, projectId, contextPacket.id, turnNo, message])).rows[0];
    await client.query("INSERT INTO event_log (project_id,actor_type,actor_id,event_type,entity_type,entity_id,summary,payload) VALUES ($1,'founder',$2,'created','conversation_turn',$3,$4,$5)", [projectId, userId, founderTurn.id, "Saved founder chat turn", { context_packet_id: contextPacket.id, turn_no: founderTurn.turn_no }]);
    return { contextPacket, founderTurn, sessionId: session.id, nextTurn: Number(turnNo) + 1, responsePlan };
  });
}

async function recreateContextPacket(client, projectId, founderTurnId, assistantTurnId = null) {
  const existing = (await client.query("SELECT context_packets.* FROM conversation_turns JOIN context_packets ON context_packets.id=conversation_turns.context_packet_id WHERE conversation_turns.id=$1 AND conversation_turns.project_id=$2", [founderTurnId, projectId])).rows[0];
  if (existing) return existing;
  const memory = await fullMemory(projectId, client);
  const packet = buildContextPacket(memory);
  const plan = await activePlan(projectId, client);
  const packetData = {
    ...packet.data,
    response_plan: (plan?.items || []).filter(item => item.status === "pending").slice(0, 5),
    cofounder_mode: plan?.mode || "explorer",
    recovery: { source: "missing_context_packet", founder_turn_id: founderTurnId }
  };
  const row = (await client.query("INSERT INTO context_packets (project_id,purpose,data,included_memory_record_ids) VALUES ($1,'chat_turn_recovery',$2,$3) RETURNING *", [projectId, packetData, packet.included_memory_record_ids])).rows[0];
  const turnIds = [founderTurnId, assistantTurnId].filter(Boolean);
  await client.query("UPDATE conversation_turns SET context_packet_id=$1 WHERE project_id=$2 AND id=ANY($3::uuid[]) AND context_packet_id IS NULL", [row.id, projectId, turnIds]);
  return row;
}

async function persistDiscoveryFacts(client, projectId, facts, sourceTurnId) {
  for (const fact of facts || []) {
    const existing = (await client.query("SELECT id FROM discovery_facts WHERE project_id=$1 AND field_key=$2 AND status='current' FOR UPDATE", [projectId, fact.field])).rows[0];
    if (existing) await client.query("UPDATE discovery_facts SET status='superseded', updated_at=now() WHERE id=$1", [existing.id]);
    await client.query("INSERT INTO discovery_facts (project_id,field_key,statement,classification,confidence,source_turn_id,provenance) VALUES ($1,$2,$3,$4,$5,$6,$7)", [projectId, fact.field, fact.statement.trim(), fact.classification, fact.confidence, sourceTurnId, { source_ids: fact.source_ids, source: "cofounder_chat" }]);
  }
}

const recoverableDiscoveryFields = new Set(["customer_segment", "problem", "context", "current_workaround", "desired_outcome", "solution", "buyer", "first_dollar_offer"]);
const recoverableDiscoveryClassifications = new Set(["founder_statement", "inference", "assumption", "evidence_observation"]);
const recoverableDiscoveryConfidence = new Set(["low", "medium", "high"]);

function recoveredDiscoveryFacts(turn) {
  const payload = turn?.structured_payload || {};
  const facts = payload.enrichment?.discovery_facts || payload.discovery_facts || [];
  return Array.isArray(facts) ? facts.filter(fact => recoverableDiscoveryFields.has(fact?.field) && typeof fact.statement === "string" && fact.statement.trim() && recoverableDiscoveryClassifications.has(fact.classification) && recoverableDiscoveryConfidence.has(fact.confidence)).map(fact => ({
    field: fact.field,
    statement: fact.statement.trim(),
    classification: fact.classification,
    confidence: fact.confidence,
    source_ids: Array.isArray(fact.source_ids) ? fact.source_ids : []
  })) : [];
}

async function restoreDiscoveryState(projectId) {
  return transaction(async client => {
    const project = (await client.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [projectId])).rows[0];
    if (!project || project.onboarding_state !== "discovery") return { restored_count: 0, checkpoint_status: project?.checkpoint_status || null };
    const missingPackets = (await client.query(`
      SELECT founder.id AS founder_turn_id, founder.session_id, founder.content,
             ai.id AS assistant_turn_id, ai.structured_payload
      FROM conversation_turns founder
      JOIN conversation_turns ai
        ON ai.session_id=founder.session_id
       AND ai.turn_no=founder.turn_no + 1
       AND ai.actor_type='ai'
      WHERE founder.project_id=$1
        AND founder.actor_type='founder'
        AND founder.context_packet_id IS NULL
      ORDER BY founder.turn_no ASC
    `, [projectId])).rows;
    for (const turn of missingPackets) {
      const packet = await recreateContextPacket(client, projectId, turn.founder_turn_id, turn.assistant_turn_id);
      const job = (await client.query("SELECT id,status,payload FROM background_jobs WHERE project_id=$1 AND job_type='turn_enrichment' AND payload->>'founder_turn_id'=$2 ORDER BY created_at DESC LIMIT 1", [projectId, turn.founder_turn_id])).rows[0];
      const hasEnrichment = Boolean(turn.structured_payload?.enrichment);
      if (job) {
        const shouldQueue = !hasEnrichment && job.status !== "running";
        await client.query("UPDATE background_jobs SET payload=payload || $2::jsonb, status=CASE WHEN $3 THEN 'queued' ELSE status END, attempts=CASE WHEN $3 THEN 0 ELSE attempts END, available_at=CASE WHEN $3 THEN now() ELSE available_at END, last_error=CASE WHEN $3 THEN NULL ELSE last_error END, updated_at=now() WHERE id=$1", [job.id, JSON.stringify({ context_packet_id: packet.id }), shouldQueue]);
      } else if (!hasEnrichment) {
        await enqueueJob(projectId, "turn_enrichment", { project_id: projectId, user_id: null, founder_turn_id: turn.founder_turn_id, assistant_turn_id: turn.assistant_turn_id, context_packet_id: packet.id, session_id: turn.session_id, message: turn.content }, `recovery:${turn.founder_turn_id}`, client);
      }
    }
    const currentFields = new Set((await client.query("SELECT field_key FROM discovery_facts WHERE project_id=$1 AND status='current'", [projectId])).rows.map(row => row.field_key));
    const missingFields = new Set([...recoverableDiscoveryFields].filter(field => !currentFields.has(field)));
    const assistantTurns = (await client.query(`
      SELECT founder.id AS founder_turn_id, ai.structured_payload
      FROM conversation_turns founder
      JOIN conversation_turns ai
        ON ai.session_id=founder.session_id
       AND ai.turn_no=founder.turn_no + 1
       AND ai.actor_type='ai'
      WHERE founder.project_id=$1 AND founder.actor_type='founder'
      ORDER BY founder.turn_no ASC
    `, [projectId])).rows;
    const restored = [];
    for (const turn of assistantTurns) {
      const facts = recoveredDiscoveryFacts({ structured_payload: turn.structured_payload });
      for (const fact of facts) {
        if (!missingFields.has(fact.field)) continue;
        await persistDiscoveryFacts(client, projectId, [fact], turn.founder_turn_id);
        await saveMemoryItems(client, extractWorkingItems({ facts: [fact], sourceTurnId: turn.founder_turn_id, projectId }));
        restored.push(fact.field);
      }
    }
    const memory = await fullMemory(projectId, client);
    const readiness = discoveryPlan(memory).checkpoint_ready;
    const checkpointStatus = readiness ? "ready" : "not_ready";
    const metadata = { ...(project.checkpoint_metadata || {}), readiness, ...(restored.length ? { recovered_at: new Date().toISOString(), recovered_fact_count: restored.length } : {}) };
    await client.query("UPDATE projects SET checkpoint_status=$2, checkpoint_metadata=$3 WHERE id=$1", [projectId, checkpointStatus, metadata]);
    return { restored_count: restored.length, restored_fields: restored, checkpoint_status: checkpointStatus };
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
    await markPlanItems(client, output.consumed_plan_item_ids, "consumed", assistantTurn.id);
    await markPlanItems(client, output.skipped_plan_item_ids, "skipped", assistantTurn.id);
    await client.query("INSERT INTO event_log (project_id,actor_type,actor_id,event_type,entity_type,entity_id,summary,payload) VALUES ($1,'ai',$2,'created','conversation_turn',$3,$4,$5)", [projectId, userId, assistantTurn.id, "Saved AI chat turn", { context_packet_id: saved.contextPacket.id, turn_no: assistantTurn.turn_no, model: output.model, prompt_version: output.prompt_version }]);
    const recommendation = await persistRecommendation(client, projectId, saved.contextPacket, plan, output.recommendation);
    return { assistantTurn, recommendation, plan: saved.responsePlan };
  });
}

async function handleFounderMessage(projectId, userId, message, options = {}) {
  if (typeof message !== "string" || !message.trim()) throw Object.assign(new Error("Chat message is required"), { status: 422 });
  const saved = await persistConversationTurn(projectId, message.trim(), userId, { topic: options.topic || "general", sessionId: options.sessionId || null });
  // The full ranking is persisted in the context packet, and its deterministic
  // result is the canonical recommendation source for this chat turn.
  const plan = {
    recommendation: { ...saved.contextPacket.data.deterministic_recommendation, issue: saved.contextPacket.data.top_unresolved_issue || null },
    ranked_issues: saved.contextPacket.data.ranked_unresolved_issues || [],
    selected_issue: saved.contextPacket.data.top_unresolved_issue || null
  };
  let raw, fallbackError = null;
  try {
    raw = await (options.callFastCofounderModel || options.callCofounderModel || callFastCofounderModel)({ projectId, userId, message: saved.founderTurn.content, contextPacket: saved.contextPacket, founderTurn: saved.founderTurn });
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
  const result = {
    founder_turn: saved.founderTurn,
    assistant_turn: persisted.assistantTurn,
    context_packet: saved.contextPacket,
    recommendation: persisted.recommendation,
    response_plan: saved.responsePlan,
    consumed_plan_item_ids: output.consumed_plan_item_ids || [],
    skipped_plan_item_ids: output.skipped_plan_item_ids || [],
    processing: { status: "queued", job_type: "turn_enrichment" },
    ...(fallbackError ? { error: fallbackError } : {})
  };

  const extractionKey = options.idempotencyKey || options.idempotency_key || options.clientRequestId || options.client_request_id || saved.founderTurn.id;
  try {
    await enqueueJob(projectId, "turn_enrichment", {
      project_id: projectId,
      user_id: userId,
      founder_turn_id: saved.founderTurn.id,
      assistant_turn_id: persisted.assistantTurn.id,
      context_packet_id: saved.contextPacket.id,
      session_id: saved.sessionId,
      message: saved.founderTurn.content,
      consumed_plan_item_ids: output.consumed_plan_item_ids || [],
      skipped_plan_item_ids: output.skipped_plan_item_ids || [],
      naming_prompted: (saved.responsePlan?.items || []).some(item => item.intent === "checkpoint_name_company" && (output.consumed_plan_item_ids || []).includes(item.id))
    }, extractionKey);
  } catch (error) {
    result.processing = { status: "unavailable", error: error.message };
  }

  // Preserve the old injected-model contract for tests and local callers that
  // explicitly opt into synchronous proposals. Production uses the queue.
  if (options.inlineExtraction) {
    const isDiscovery = saved.contextPacket.data.project_snapshot?.onboarding_state === "discovery";
    const hasMaterialProposal = (!isDiscovery || options.inlineExtraction) && (output.proposed_belief_updates.length || output.proposed_records.length);
    if (hasMaterialProposal) {
      try {
        const proposalOutput = output.recommendation.source_ids.length ? output : { ...output, recommendation: { ...output.recommendation, source_ids: [saved.contextPacket.id, persisted.assistantTurn.id] } };
        result.change_set = await (options.proposeChangeSet || proposeChangeSet)(projectId, proposalOutput, {
          source_turn_id: persisted.assistantTurn.id,
          idempotency_key: idempotencyKey(projectId, output, saved.contextPacket, saved.founderTurn, extractionKey),
          include_recommendation: false,
          proposal_metadata: { phase: 6, source_turn_id: persisted.assistantTurn.id, context_packet_id: saved.contextPacket.id, provenance: { founder_turn_id: saved.founderTurn.id, assistant_turn_id: persisted.assistantTurn.id } }
        });
      } catch (error) {
        result.proposal_error = { code: error.code || "CHANGE_SET_VALIDATION_FAILED", message: "The response was saved, but its proposed updates need correction before review.", detail: error.message };
      }
    }
  }
  return result;
}

async function handleEnrichmentJob(payload, { extractor = callOpenAIModel, proposer = proposeChangeSet } = {}) {
  const packetResult = await query("SELECT * FROM context_packets WHERE id=$1 AND project_id=$2", [payload.context_packet_id, payload.project_id]);
  const founderResult = await query("SELECT * FROM conversation_turns WHERE id=$1 AND project_id=$2 AND actor_type='founder'", [payload.founder_turn_id, payload.project_id]);
  if (!founderResult.rows[0]) throw new Error("Enrichment source conversation was not found.");
  const founderTurn = founderResult.rows[0];
  const contextPacket = packetResult.rows[0] || await transaction(async client => recreateContextPacket(client, payload.project_id, founderTurn.id, payload.assistant_turn_id));
  founderTurn.context_packet_id = contextPacket.id;
  let raw = await extractor({ projectId: payload.project_id, userId: payload.user_id, message: payload.message, contextPacket, founderTurn });
  const plan = { recommendation: { ...contextPacket.data.deterministic_recommendation, issue: contextPacket.data.top_unresolved_issue || null }, ranked_issues: contextPacket.data.ranked_unresolved_issues || [], selected_issue: contextPacket.data.top_unresolved_issue || null };
  const output = normalizeCofounderOutput(raw, contextPacket, founderTurn, plan);
  await transaction(async client => {
    const memory = await fullMemory(payload.project_id, client);
    if (memory.project?.onboarding_state === "discovery") {
      await persistDiscoveryFacts(client, payload.project_id, output.discovery_facts, founderTurn.id);
      await saveMemoryItems(client, extractWorkingItems({ facts: output.discovery_facts, sourceTurnId: founderTurn.id, projectId: payload.project_id }));
    }
    const completedTask = payload.message.match(/I completed this task:\s*([^.!?]+)[.!?]?/i);
    if (completedTask) {
      const task = (await client.query("SELECT id FROM tasks WHERE project_id=$1 AND lower(title)=lower($2) LIMIT 1", [payload.project_id, completedTask[1].trim()])).rows[0];
      if (task) {
        await client.query("UPDATE tasks SET status='done' WHERE id=$1", [task.id]);
        await client.query("INSERT INTO event_log (project_id,actor_type,actor_id,event_type,entity_type,entity_id,summary,payload) VALUES ($1,'ai',$2,'completed','task',$3,$4,$5)", [payload.project_id, payload.user_id, task.id, "Marked task complete from founder's chat report", { source_turn_id: founderTurn.id }]);
      }
    }
    const completedExperiment = payload.message.match(/I recorded an experiment result:\s*([^.!?]+)[.!?]?/i);
    if (completedExperiment) {
      const experiment = (await client.query("SELECT id FROM experiments WHERE project_id=$1 AND lower(title)=lower($2) LIMIT 1", [payload.project_id, completedExperiment[1].trim()])).rows[0];
      if (experiment) await client.query("UPDATE experiments SET status='completed', completed_at=now() WHERE id=$1", [experiment.id]);
    }
    const latestMemory = await fullMemory(payload.project_id, client);
    const namingWasPrompted = Boolean(payload.naming_prompted);
    const candidateName = payload.message.trim().replace(/^(maybe|call it|we could call it|i'd call it|let's call it)[:\s]*/i, "").replace(/[.!?]+$/, "").trim();
    const looksLikeNameResponse = namingWasPrompted && candidateName.length >= 2 && candidateName.length <= 120 && !/[?\n]/.test(candidateName);
    const readiness = discoveryPlan(latestMemory).checkpoint_ready;
    const checkpointStatus = looksLikeNameResponse ? "snapshot_pending" : readiness ? "ready" : "not_ready";
    await client.query("UPDATE projects SET checkpoint_status=$2, checkpoint_metadata=$3 WHERE id=$1", [payload.project_id, checkpointStatus, { readiness, source_turn_id: founderTurn.id, ...(looksLikeNameResponse ? { name_candidate: candidateName } : {}) }]);
    await client.query("UPDATE conversation_turns SET structured_payload=structured_payload || $2::jsonb WHERE id=$1", [payload.assistant_turn_id, JSON.stringify({ enrichment: output, enriched_at: new Date().toISOString() })]);
    await replacePlan(client, payload.project_id, payload.session_id, latestMemory, { sourceTurnId: founderTurn.id, sourceIds: [contextPacket.id, founderTurn.id], message: payload.message });
  });
  const isDiscovery = contextPacket.data.project_snapshot?.onboarding_state === "discovery";
  if (!isDiscovery && (output.proposed_belief_updates.length || output.proposed_records.length)) {
    const proposalOutput = output.recommendation.source_ids.length ? output : { ...output, recommendation: { ...output.recommendation, source_ids: [contextPacket.id, payload.assistant_turn_id] } };
    await proposer(payload.project_id, proposalOutput, {
      source_turn_id: payload.assistant_turn_id,
      idempotency_key: `enrichment:${payload.founder_turn_id}`,
      include_recommendation: false,
      proposal_metadata: { phase: 6, enrichment: true, context_packet_id: contextPacket.id, provenance: { founder_turn_id: founderTurn.id, assistant_turn_id: payload.assistant_turn_id } }
    });
  }
  return output;
}

module.exports = { handleFounderMessage, handleEnrichmentJob, callCofounderModel, callFastCofounderModel, callOpenAIModel, normalizeCofounderOutput, persistConversationTurn, idempotencyKey, fullMemory, persistDiscoveryFacts, restoreDiscoveryState };
