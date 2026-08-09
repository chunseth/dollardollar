require("./env").loadEnv();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { query, transaction } = require("./db");
const { createDraft, createPlan, normalizeDraft, fields: onboardingFields, industries, industryModules, revenuePathFields, projectTitle } = require("./onboarding");
const { buildProjectContext } = require("./context");
const { handleFounderMessage } = require("./cofounder");
const { createBeliefFromAssumption, appendBeliefVersion, linkEvidenceToBeliefVersion } = require("./beliefs");
const { proposeChangeSet, approveChangeSet, approveChangeSetItems, rejectChangeSet, editChangeSetItem, getPendingChangeSetsForProject, applyApprovedChangeSet } = require("./change_sets");

const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const publicFiles = new Set(["index.html", "app.js", "styles.css", "overrides.css"]);
const port = Number(process.env.PORT) || 3000;
const entities = {
  assumptions: { table: "assumptions", required: ["statement", "category"], fields: ["statement", "category", "subcategory", "status", "priority", "confidence", "source", "owner", "importance", "uncertainty", "risk_score", "revenue_blocker"] },
  evidence: { table: "evidence", required: ["source_type", "source_title", "summary"], fields: ["source_type", "source_title", "summary", "raw_text", "source_date", "source_person_name", "source_company", "strength", "confidence", "specificity", "recency", "bias_risk", "willingness_to_pay_signal", "behavior_vs_opinion"] },
  experiments: { table: "experiments", required: ["title", "hypothesis", "success_metric"], fields: ["assumption_id", "title", "hypothesis", "test_design", "success_metric", "success_threshold", "status", "expected_duration", "owner", "started_at", "completed_at"] },
  tasks: { table: "tasks", required: ["title"], fields: ["experiment_id", "assumption_id", "title", "description", "priority", "status", "due_date", "estimated_minutes", "impact_level", "effort_level", "source"] },
  decisions: { table: "decisions", required: ["title", "decision"], fields: ["title", "decision", "reason", "status", "decided_at"] }
};
const projectFields = ["name", "short_description", "long_description", "stage", "status", "target_customer", "problem_statement", "solution_summary", "revenue_model", "pricing_hypothesis", "validation_stage", "project_memory_summary", "founder_goal", "founder_constraints", "first_dollar_path", "primary_industry", "secondary_industry", "industry_confidence", "industry_rationale", "industry_details"];
const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
const singular = entity => ({ evidence: "evidence" })[entity] || entity.slice(0, -1);
const userId = request => request.headers["x-user-id"] || "local-founder";
const send = (response, status, data) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" }); response.end(JSON.stringify(data)); return true; };
const fail = (response, status, message, details) => send(response, status, { error: message, ...(details ? { details } : {}) });
const pick = (body, fields) => Object.fromEntries(fields.filter(field => body[field] !== undefined).map(field => [field, body[field]]));
const draftRequests = new Map();
function allowDraft(request) { const key = request.socket.remoteAddress || "local"; const now = Date.now(); const prior = (draftRequests.get(key) || []).filter(time => now - time < 60_000); if (prior.length >= 5) return false; prior.push(now); draftRequests.set(key, prior); return true; }

function validate(entity, values, partial = false) {
  const definition = entities[entity]; const errors = {};
  if (!partial) definition.required.forEach(field => { if (typeof values[field] !== "string" || !values[field].trim()) errors[field] = "is required"; });
  if (values.estimated_minutes !== undefined && (!Number.isInteger(values.estimated_minutes) || values.estimated_minutes < 1)) errors.estimated_minutes = "must be a positive integer";
  if (values.risk_score !== undefined && (!Number.isInteger(values.risk_score) || values.risk_score < 0 || values.risk_score > 100)) errors.risk_score = "must be an integer from 0 to 100";
  if (values.importance !== undefined && (!Number.isInteger(values.importance) || values.importance < 1 || values.importance > 5)) errors.importance = "must be an integer from 1 to 5";
  if (values.uncertainty !== undefined && (!Number.isInteger(values.uncertainty) || values.uncertainty < 1 || values.uncertainty > 5)) errors.uncertainty = "must be an integer from 1 to 5";
  return Object.keys(errors).length ? errors : null;
}
function validateProject(values, currentIndustry = "") {
  const errors = {}, primary = values.primary_industry === undefined ? currentIndustry : values.primary_industry;
  if (values.primary_industry !== undefined && !industries.includes(values.primary_industry)) errors.primary_industry = "must be a supported industry";
  if (values.secondary_industry !== undefined && values.secondary_industry && (!industries.includes(values.secondary_industry) || values.secondary_industry === primary)) errors.secondary_industry = "must be a different supported industry";
  if (values.industry_confidence !== undefined && !["high", "medium", "low"].includes(values.industry_confidence)) errors.industry_confidence = "must be high, medium, or low";
  if (values.industry_details !== undefined) {
    if (!primary || !industryModules[primary] || !values.industry_details || Array.isArray(values.industry_details) || typeof values.industry_details !== "object") errors.industry_details = "requires a primary industry and an object";
    else if (Object.keys(values.industry_details).some(field => !industryModules[primary].fields.includes(field))) errors.industry_details = "contains fields not allowed for the primary industry";
  }
  if (values.first_dollar_path !== undefined && (!values.first_dollar_path || Array.isArray(values.first_dollar_path) || typeof values.first_dollar_path !== "object" || Object.keys(values.first_dollar_path).some(field => !revenuePathFields.includes(field)))) errors.first_dollar_path = "must contain only supported first-dollar path fields";
  return Object.keys(errors).length ? errors : null;
}
async function readBody(request) { let body = ""; for await (const chunk of request) { body += chunk; if (body.length > 1_000_000) throw new Error("Request body is too large"); } try { return body ? JSON.parse(body) : {}; } catch { const error = new Error("Request body must be valid JSON"); error.status = 400; throw error; } }
async function log(client, projectId, actorType, eventType, entityType, entityId, summary, payload = {}) { return (await client.query("INSERT INTO event_log (project_id, actor_type, event_type, entity_type, entity_id, summary, payload) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [projectId, actorType, eventType, entityType, entityId, summary, payload])).rows[0].id; }
async function ownedProject(projectId, owner) { const result = await query("SELECT * FROM projects WHERE id=$1 AND user_id=$2", [projectId, owner]); return result.rows[0]; }
async function fullMemory(projectId, executor = { query }, includeConversation = false) {
  const project = await executor.query("SELECT * FROM projects WHERE id=$1", [projectId]);
  const assumptions = await executor.query("SELECT * FROM assumptions WHERE project_id=$1 ORDER BY risk_score DESC, created_at", [projectId]);
  const evidence = await executor.query("SELECT * FROM evidence WHERE project_id=$1 ORDER BY created_at DESC", [projectId]);
  const experiments = await executor.query("SELECT * FROM experiments WHERE project_id=$1 ORDER BY created_at DESC", [projectId]);
  const tasks = await executor.query("SELECT * FROM tasks WHERE project_id=$1 ORDER BY created_at", [projectId]);
  const decisions = await executor.query("SELECT * FROM decisions WHERE project_id=$1 ORDER BY created_at DESC", [projectId]);
  const milestones = await executor.query("SELECT * FROM roadmap_milestones WHERE project_id=$1 ORDER BY position", [projectId]);
  const links = await executor.query("SELECT ae.* FROM assumption_evidence ae JOIN evidence e ON e.id=ae.evidence_id WHERE e.project_id=$1", [projectId]);
  const beliefs = await executor.query("SELECT b.id, b.origin_assumption_id, b.current_version_id, b.is_active, bv.version_number, bv.statement, bv.classification, bv.validation_status, bv.confidence, bv.importance, bv.scope, bv.rationale, bv.source_event_id, bv.source_turn_id, bv.source_user_id, bv.source_assumption_id, bv.source_identifier, bv.provenance, bv.created_at AS version_created_at FROM beliefs b JOIN belief_versions bv ON bv.id=b.current_version_id WHERE b.project_id=$1 AND b.is_active=true ORDER BY bv.created_at DESC", [projectId]);
  const beliefEvidenceLinks = await executor.query("SELECT bel.* FROM belief_evidence_links bel JOIN belief_versions bv ON bv.id=bel.belief_version_id JOIN beliefs b ON b.id=bv.belief_id WHERE b.project_id=$1 ORDER BY bel.created_at DESC", [projectId]);
  const events = await executor.query("SELECT * FROM event_log WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50", [projectId]);
  const memory = { project: project.rows[0], assumptions: assumptions.rows, evidence: evidence.rows, experiments: experiments.rows, tasks: tasks.rows, decisions: decisions.rows, roadmap_milestones: milestones.rows, assumption_evidence: links.rows, beliefs: beliefs.rows, belief_evidence_links: beliefEvidenceLinks.rows, events: events.rows };
  if (!includeConversation) return memory;
  const recommendation = await executor.query("SELECT id, context_packet_id, recommendation, created_at FROM recommendations WHERE project_id=$1 AND status='active' ORDER BY created_at DESC, id DESC LIMIT 1", [projectId]);
  const conversationTurns = await executor.query("SELECT id, session_id, turn_no, actor_type, content, created_at FROM conversation_turns WHERE project_id=$1 ORDER BY created_at DESC, turn_no DESC, id DESC LIMIT 20", [projectId]);
  return { ...memory, latest_recommendation: recommendation.rows[0] || null, conversation_turns: conversationTurns.rows };
}

const chatPromptVersion = "conversation-loop-v1";
const placeholderModel = "local-placeholder";
function memoryRecordIds(memory) {
  return Object.fromEntries(Object.entries(memory).map(([name, records]) => [name, Array.isArray(records) ? records.map(record => String(record.id)).filter(Boolean) : records?.id ? [String(records.id)] : []]));
}
function validateAssistantPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Object.assign(new Error("Assistant payload must be an object"), { status: 502 });
  for (const field of ["assistant_message", "model", "prompt_version"]) if (typeof payload[field] !== "string" || !payload[field].trim()) throw Object.assign(new Error(`Assistant payload requires ${field}`), { status: 502 });
  if (!payload.structured_payload || typeof payload.structured_payload !== "object" || Array.isArray(payload.structured_payload)) throw Object.assign(new Error("Assistant payload requires structured_payload to be an object"), { status: 502 });
  if (!payload.recommendation || typeof payload.recommendation !== "object" || Array.isArray(payload.recommendation)) throw Object.assign(new Error("Assistant payload requires recommendation to be an object"), { status: 502 });
  if (!payload.included_memory_record_ids || typeof payload.included_memory_record_ids !== "object" || Array.isArray(payload.included_memory_record_ids)) throw Object.assign(new Error("Assistant payload requires included_memory_record_ids to be an object"), { status: 502 });
  return payload;
}
// `createServer({ generateAssistant })` is the test seam. It accepts exactly this
// JSON-safe payload shape and never reads a request-supplied assistant payload.
// Production currently uses this stable placeholder instead of making an OpenAI call.
function placeholderAssistant({ contextPacket, founderTurn }) {
  return {
    assistant_message: "I saved your message. AI responses are not configured yet, so I cannot generate a substantive recommendation.",
    model: placeholderModel,
    prompt_version: chatPromptVersion,
    structured_payload: { mode: "placeholder", reason: "No assistant generator is configured." },
    recommendation: { state: "question", primary_issue: "Assistant configuration is pending", reason: "This is a stable local placeholder response.", action_payload: {}, confidence: 0, source_ids: [contextPacket.id, founderTurn.id] },
    included_memory_record_ids: contextPacket.included_memory_record_ids
  };
}
async function chatHistory(projectId) {
  return (await query("SELECT id, session_id, context_packet_id, turn_no, actor_type, content, model, prompt_version, structured_payload, created_at FROM conversation_turns WHERE project_id=$1 ORDER BY created_at ASC, turn_no ASC", [projectId])).rows;
}

async function api(request, response, url, generatePlan = createPlan, generateAssistant = placeholderAssistant) {
  const parts = url.pathname.split("/").filter(Boolean); const method = request.method; const owner = userId(request);
  if (url.pathname === "/api/onboarding/draft" && method === "POST") { if (!allowDraft(request)) return fail(response, 429, "Too many onboarding drafts. Please wait a minute and try again."); const draft = await createDraft(await readBody(request)); return send(response, 200, { draft, requires_follow_up: draft.requires_follow_up === true }); }
  if (url.pathname === "/api/onboarding/confirm" && method === "POST") {
    const body = await readBody(request), draft = normalizeDraft(body.draft, body.draft?.profile?.short_description?.value || body.draft?.profile?.solution_summary?.value), accepted = body.accepted || {};
    const profile = Object.fromEntries(onboardingFields.filter(field => (field === "name" || accepted.profile?.includes(field)) && draft.profile[field].value).map(field => [field, field === "name" ? projectTitle(draft.profile[field].value) : draft.profile[field].value]));
    const revenuePath = Object.fromEntries(Object.entries(draft.primary_revenue_path).filter(([field, item]) => accepted.revenue_path?.includes(field) && item.value).map(([field, item]) => [field, item.value]));
    if (Object.keys(revenuePath).length) profile.first_dollar_path = revenuePath;
    if (accepted.industry?.primary_industry) {
      profile.primary_industry = draft.industry.primary_industry;
      if (accepted.industry.secondary_industry && draft.industry.secondary_industry) profile.secondary_industry = draft.industry.secondary_industry;
      if (accepted.industry.industry_confidence) profile.industry_confidence = draft.industry.industry_confidence;
      if (accepted.industry.industry_rationale && draft.industry.industry_rationale) profile.industry_rationale = draft.industry.industry_rationale;
      const details = Object.fromEntries(Object.entries(draft.industry.industry_details).filter(([field, item]) => accepted.industry.details?.includes(field) && item.value).map(([field, item]) => [field, item.value]));
      if (Object.keys(details).length) profile.industry_details = details;
    }
    if (!profile.name) return fail(response, 422, "Confirm a project name before saving.");
    const selectedAssumptions = draft.assumptions.filter(item => accepted.assumptions?.includes(item.draft_id));
    const selectedMilestones = draft.roadmap_milestones.filter(item => accepted.milestones === undefined || accepted.milestones.includes(item.draft_id));
    const selectedTasks = draft.tasks.filter(item => accepted.tasks?.includes(item.draft_id));
    const project = await transaction(async client => {
      const projectFields = ["user_id", ...Object.keys(profile)], projectValues = [owner, ...Object.values(profile)];
      const created = (await client.query(`INSERT INTO projects (${projectFields.join(",")}) VALUES (${projectFields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, projectValues)).rows[0];
      await log(client, created.id, "founder", "confirmed", "project", created.id, `Confirmed onboarding profile for ${created.name}`, profile);
      const ids = new Map();
      for (const item of selectedAssumptions) { const rationale = [item.rationale, item.validation_criterion ? `Falsification criterion: ${item.validation_criterion}` : ""].filter(Boolean).join("\n\n"); const row = (await client.query("INSERT INTO assumptions (project_id,statement,category,priority,risk_score,subcategory,status,source,revenue_blocker) VALUES ($1,$2,$3,$4,$5,$6,'untested','ai', $7) RETURNING *", [created.id, item.statement, item.category, item.priority, item.risk_score, rationale || null, item.category === "willingness_to_pay" || item.risk_score >= 75])).rows[0]; ids.set(item.draft_id, row.id); await log(client, created.id, "founder", "confirmed", "assumption", row.id, `Confirmed onboarding assumption: ${item.statement}`, item); await createBeliefFromAssumption(client, row, { source_user_id: owner, source_identifier: "onboarding_assumption", provenance: { onboarding: true, draft_id: item.draft_id } }, { projectId: created.id }); }
      for (const item of selectedMilestones) { const row = (await client.query("INSERT INTO roadmap_milestones (project_id,assumption_id,title,description,success_metric,position,source) VALUES ($1,$2,$3,$4,$5,$6,'ai') RETURNING id", [created.id, ids.get(item.assumption_draft_id) || null, item.title, item.description, item.success_metric, item.position])).rows[0]; await log(client, created.id, "founder", "confirmed", "roadmap_milestone", row.id, `Confirmed first-dollar milestone: ${item.title}`, item); }
      for (const item of selectedTasks) { const details = [`Target: ${item.target_segment}`, `Quantity: ${item.target_quantity}`, `Deadline: ${item.deadline}`, `Success metric: ${item.success_metric}`, `Next step: ${item.next_step}`, `Why now: ${item.rationale}`].filter(Boolean).join("\n\n"); const row = (await client.query("INSERT INTO tasks (project_id,assumption_id,title,description,priority,estimated_minutes,impact_level,source) VALUES ($1,$2,$3,$4,$5,$6,'first_revenue','ai') RETURNING id", [created.id, ids.get(item.assumption_draft_id) || null, item.title, `${item.description}\n\n${details}`, item.priority, item.estimated_minutes])).rows[0]; await log(client, created.id, "founder", "confirmed", "task", row.id, `Confirmed onboarding task: ${item.title}`, item); }
      return created;
    });
    return send(response, 201, { project });
  }
  if (parts[1] !== "projects") return false;
  if (parts.length === 2 && method === "GET") return send(response, 200, { projects: (await query("SELECT * FROM projects WHERE user_id=$1 ORDER BY updated_at DESC", [owner])).rows });
  if (parts.length === 2 && method === "POST") { const body = await readBody(request); const values = pick(body, projectFields), errors = validateProject(values); if (!values.name || !String(values.name).trim() || errors) return fail(response, 422, "Invalid project", { ...(!values.name || !String(values.name).trim() ? { name: "is required" } : {}), ...(errors || {}) }); const result = await transaction(async client => { const fields = ["user_id", ...Object.keys(values)], params = [owner, ...Object.values(values)]; const row = (await client.query(`INSERT INTO projects (${fields.join(",")}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, params)).rows[0]; await log(client, row.id, "founder", "created", "project", row.id, `Created project ${row.name}`, values); return row; }); return send(response, 201, { project: result }); }
  const projectId = parts[2], existingProject = validUuid(projectId) ? await ownedProject(projectId, owner) : null; if (!existingProject) return fail(response, 404, "Project not found");
  if (parts[3] === "change-sets") {
    const context = { actor_id: owner, project_id: projectId };
    if (parts.length === 4 && method === "GET") return send(response, 200, { change_sets: await getPendingChangeSetsForProject(projectId, context) });
    if (parts.length === 4 && method === "POST") {
      const body = await readBody(request);
      return send(response, 201, { change_set: await proposeChangeSet(projectId, body) });
    }
    const changeSetId = parts[4];
    if (!changeSetId) return fail(response, 404, "Change set not found");
    if (parts.length === 6 && parts[5] === "approve" && method === "POST") return send(response, 200, { change_set: await approveChangeSet(projectId, changeSetId, context) });
    if (parts.length === 6 && parts[5] === "approve-items" && method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { change_set: await approveChangeSetItems(projectId, changeSetId, body.item_ids, context) });
    }
    if (parts.length === 6 && parts[5] === "reject" && method === "POST") {
      const body = await readBody(request);
      return send(response, 200, { change_set: await rejectChangeSet(projectId, changeSetId, context, body.reason || null) });
    }
    if (parts.length === 6 && parts[5] === "apply" && method === "POST") return send(response, 200, { change_set: await applyApprovedChangeSet(projectId, changeSetId, context) });
    if (parts.length === 8 && parts[5] === "items" && parts[7] === "edit" && method === "PATCH") {
      const body = await readBody(request);
      return send(response, 200, { item: await editChangeSetItem(projectId, changeSetId, parts[6], body.payload, context) });
    }
    return fail(response, 404, "Change-set route not found");
  }
  if (parts[3] === "chat" && parts.length === 4 && method === "GET") return send(response, 200, { turns: await chatHistory(projectId) });
  if (parts[3] === "recommendation" && parts.length === 4 && method === "GET") {
    const recommendation = (await query("SELECT id, context_packet_id, recommendation, created_at FROM recommendations WHERE project_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 1", [projectId])).rows[0];
    return send(response, 200, { recommendation: recommendation || null });
  }
  if (parts[3] === "chat" && parts.length === 4 && method === "POST") {
    const body = await readBody(request);
    if (typeof body.message !== "string" || !body.message.trim()) return fail(response, 422, "Chat message is required");
    if (body.message.length > 20_000) return fail(response, 422, "Chat message must be 20,000 characters or fewer");
    const result = await handleFounderMessage(projectId, owner, body.message, { callCofounderModel: generateAssistant });
    return send(response, 201, result);
  }
  if (parts[3] === "memory" && method === "GET") return send(response, 200, await fullMemory(projectId));
  if (parts[3] === "plan" && method === "POST") {
    const assumptions = (await query("SELECT id, statement, category, priority, subcategory FROM assumptions WHERE project_id=$1 ORDER BY risk_score DESC, created_at", [projectId])).rows;
    const existing = await query("SELECT 1 FROM event_log WHERE project_id=$1 AND actor_type='ai' AND event_type='generated' AND entity_type='validation_plan' LIMIT 1", [projectId]);
    if (existing.rowCount) return fail(response, 409, "A validation plan has already been generated for this project.");
    const plan = await generatePlan(existingProject, assumptions);
    const result = await transaction(async client => {
      const created = { tasks: 0, experiments: 0, milestones: 0 };
      for (const item of plan.experiments) { const assumptionId = assumptions[item.assumption_index - 1].id; const row = (await client.query("INSERT INTO experiments (project_id,assumption_id,title,hypothesis,test_design,success_metric,expected_duration,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'proposed') RETURNING id", [projectId, assumptionId, item.title, item.hypothesis, item.test_design || null, item.success_metric, item.expected_duration || null])).rows[0]; created.experiments++; await log(client, projectId, "ai", "generated", "experiment", row.id, `Generated validation experiment: ${item.title}`, item); }
      for (const item of plan.roadmap_milestones) { const assumptionId = assumptions[item.assumption_index - 1].id; const row = (await client.query("INSERT INTO roadmap_milestones (project_id,assumption_id,title,description,success_metric,position,source) VALUES ($1,$2,$3,$4,$5,$6,'ai') RETURNING id", [projectId, assumptionId, item.title, item.description, item.success_metric, item.position])).rows[0]; created.milestones++; await log(client, projectId, "ai", "generated", "roadmap_milestone", row.id, `Generated first-dollar milestone: ${item.title}`, item); }
      for (const item of plan.tasks) { const assumptionId = assumptions[item.assumption_index - 1].id; const details = [`Target: ${item.target_segment}`, `Quantity: ${item.target_quantity}`, `Deadline: ${item.deadline}`, `Success metric: ${item.success_metric}`, `Next step: ${item.next_step}`, `Why now: ${item.rationale}`].join("\n\n"); const row = (await client.query("INSERT INTO tasks (project_id,assumption_id,title,description,priority,estimated_minutes,impact_level,source) VALUES ($1,$2,$3,$4,$5,$6,'first_revenue','ai') RETURNING id", [projectId, assumptionId, item.title, `${item.description}\n\n${details}`, item.priority, item.estimated_minutes])).rows[0]; created.tasks++; await log(client, projectId, "ai", "generated", "task", row.id, `Generated validation task: ${item.title}`, item); }
      await log(client, projectId, "ai", "generated", "validation_plan", null, "Generated post-confirmation validation plan", created);
      return created;
    });
    return send(response, 201, { plan: result });
  }
  if (parts.length === 3 && method === "PATCH") { const body = await readBody(request); const values = pick(body, projectFields), errors = validateProject(values, existingProject.primary_industry); if (!Object.keys(values).length || errors) return fail(response, 422, "Invalid project update", errors || { body: "No editable project fields supplied" }); const row = await transaction(async client => { const entries = Object.entries(values); const result = await client.query(`UPDATE projects SET ${entries.map(([field], index) => `${field}=$${index + 1}`).join(",")} WHERE id=$${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), projectId]); await log(client, projectId, "founder", "updated", "project", projectId, "Updated company memory", values); return result.rows[0]; }); return send(response, 200, { project: row }); }
  if (parts.length === 3 && method === "DELETE") { await transaction(async client => { await log(client, projectId, "founder", "deleted", "project", projectId, "Deleted project"); await client.query("DELETE FROM projects WHERE id=$1", [projectId]); }); response.writeHead(204); response.end(); return true; }
  const entity = parts[3]; const definition = entities[entity];
  if (definition && parts.length === 4 && method === "GET") return send(response, 200, { [entity]: (await query(`SELECT * FROM ${definition.table} WHERE project_id=$1 ORDER BY created_at DESC`, [projectId])).rows });
  if (definition && parts.length === 4 && method === "POST") { const body = await readBody(request); const values = pick(body, definition.fields); const errors = validate(entity, values), entityName = singular(entity); if (errors) return fail(response, 422, "Invalid " + entityName, errors); const row = await transaction(async client => { const fields = ["project_id", ...Object.keys(values)], params = [projectId, ...Object.values(values)]; const result = await client.query(`INSERT INTO ${definition.table} (${fields.join(",")}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, params); const record = result.rows[0]; const eventId = await log(client, projectId, "founder", "created", entityName, record.id, `Created ${entityName}: ${record.title || record.statement || record.source_title}`, values); if (entity === "assumptions") await createBeliefFromAssumption(client, record, { source_event_id: eventId, source_user_id: owner, source_identifier: "assumption_created", provenance: { assumption_created: true } }, { projectId }); return record; }); return send(response, 201, { [entityName]: row }); }
  const entityId = parts[4];
  if (definition && validUuid(entityId) && parts.length === 5 && (method === "PATCH" || method === "DELETE")) {
    const exists = await query(`SELECT id FROM ${definition.table} WHERE id=$1 AND project_id=$2`, [entityId, projectId]); if (!exists.rowCount) return fail(response, 404, "Record not found");
    if (method === "DELETE") { const entityName = singular(entity); await transaction(async client => { await client.query(`DELETE FROM ${definition.table} WHERE id=$1`, [entityId]); await log(client, projectId, "founder", "deleted", entityName, entityId, `Deleted ${entityName}`); }); response.writeHead(204); response.end(); return true; }
    const body = await readBody(request), values = pick(body, definition.fields), errors = validate(entity, values, true); if (errors || !Object.keys(values).length) return fail(response, 422, "Invalid update", errors || { body: "No editable fields supplied" });
    const entityName = singular(entity); const row = await transaction(async client => { const entries = Object.entries(values); const result = await client.query(`UPDATE ${definition.table} SET ${entries.map(([field], index) => `${field}=$${index + 1}`).join(",")} WHERE id=$${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), entityId]); const record = result.rows[0]; const eventId = await log(client, projectId, "founder", "updated", entityName, entityId, `Updated ${entityName}`, values); if (entity === "assumptions") { let belief = (await client.query("SELECT id FROM beliefs WHERE origin_assumption_id=$1 AND project_id=$2", [entityId, projectId])).rows[0]; if (!belief) { await createBeliefFromAssumption(client, record, { source_event_id: eventId, source_user_id: owner, source_identifier: "assumption_migrated_on_update", provenance: { assumption_update: true, changed_fields: Object.keys(values) } }, { projectId }); belief = (await client.query("SELECT id FROM beliefs WHERE origin_assumption_id=$1 AND project_id=$2", [entityId, projectId])).rows[0]; } else await appendBeliefVersion(client, belief.id, { source_event_id: eventId, statement: record.statement, classification: record.category, validation_status: record.status, confidence: record.confidence, importance: record.importance, rationale: record.subcategory || null, source_assumption_id: record.id, source_user_id: owner, source_identifier: record.source, provenance: { assumption_update: true, changed_fields: Object.keys(values) } }); } return record; }); return send(response, 200, { [entityName]: row });
  }
  if (parts[3] === "assumption-evidence" && method === "POST") { const body = await readBody(request); if (!validUuid(body.assumption_id) || !validUuid(body.evidence_id) || !["supports", "contradicts", "neutral"].includes(body.relationship)) return fail(response, 422, "Invalid relationship"); const result = await transaction(async client => { const check = await client.query("SELECT (SELECT project_id FROM assumptions WHERE id=$1) assumption_project, (SELECT project_id FROM evidence WHERE id=$2) evidence_project", [body.assumption_id, body.evidence_id]); if (!check.rows[0] || check.rows[0].assumption_project !== projectId || check.rows[0].evidence_project !== projectId) { const error = new Error("Linked records must belong to this project"); error.status = 422; throw error; } let belief = (await client.query("SELECT id, current_version_id FROM beliefs WHERE origin_assumption_id=$1 AND project_id=$2 FOR UPDATE", [body.assumption_id, projectId])).rows[0]; if (!belief) { const assumption = (await client.query("SELECT * FROM assumptions WHERE id=$1 AND project_id=$2", [body.assumption_id, projectId])).rows[0]; await createBeliefFromAssumption(client, assumption, { source_user_id: owner, source_identifier: "assumption_evidence_link", provenance: { belief_created_for_evidence_link: true } }, { projectId }); belief = (await client.query("SELECT id, current_version_id FROM beliefs WHERE origin_assumption_id=$1 AND project_id=$2 FOR UPDATE", [body.assumption_id, projectId])).rows[0]; } const beliefLink = await linkEvidenceToBeliefVersion(client, belief.current_version_id, body.evidence_id, { relationship: body.relationship === "neutral" ? "neutral" : body.relationship, explanation: body.explanation, provenance: { linked_by: owner, source: "assumption_evidence_api" } }); const row = (await client.query("INSERT INTO assumption_evidence (assumption_id,evidence_id,relationship,explanation) VALUES ($1,$2,$3,$4) ON CONFLICT (assumption_id,evidence_id) DO UPDATE SET relationship=EXCLUDED.relationship, explanation=EXCLUDED.explanation RETURNING *", [body.assumption_id, body.evidence_id, body.relationship, body.explanation || null])).rows[0]; await log(client, projectId, "founder", "linked", "assumption_evidence", row.id, "Linked evidence to assumption and current belief version", { ...body, belief_version_id: beliefLink.belief_version_id }); return { ...row, belief_version_id: beliefLink.belief_version_id, belief_evidence_link_id: beliefLink.id }; }); return send(response, 201, { link: result }); }
  if (parts[3] === "relationships" && method === "POST") { const body = await readBody(request); const maps = { assumption_experiment: ["assumption_id", "experiment_id"], evidence_experiment: ["evidence_id", "experiment_id"], task_experiment: ["task_id", "experiment_id"], task_assumption: ["task_id", "assumption_id"] }; const columns = maps[body.type]; if (!columns || columns.some(column => !validUuid(body[column]))) return fail(response, 422, "Invalid relationship"); const result = await transaction(async client => { const ids = Object.values(body).filter(validUuid); const ownership = await client.query("SELECT count(*)::int AS count FROM (SELECT id FROM assumptions WHERE project_id=$1 AND id = ANY($2::uuid[]) UNION SELECT id FROM evidence WHERE project_id=$1 AND id = ANY($2::uuid[]) UNION SELECT id FROM experiments WHERE project_id=$1 AND id = ANY($2::uuid[]) UNION SELECT id FROM tasks WHERE project_id=$1 AND id = ANY($2::uuid[])) records", [projectId, ids]); if (ownership.rows[0].count !== columns.length) { const error = new Error("Linked records must belong to this project"); error.status = 422; throw error; } const params = columns.map(column => body[column]); const row = (await client.query(`WITH inserted AS (INSERT INTO ${body.type} (${columns.join(",")}) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *, true AS created) SELECT * FROM inserted UNION ALL SELECT *, false AS created FROM ${body.type} WHERE ${columns[0]}=$1 AND ${columns[1]}=$2 LIMIT 1`, params)).rows[0]; await log(client, projectId, "founder", "linked", body.type, null, `${row.created ? "Created" : "Reused"} ${body.type} link`, body); return row; }); return send(response, 201, { relationship: result }); }
  return false;
}

function createServer({ generatePlan = createPlan, generateAssistant = placeholderAssistant } = {}) {
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) { const handled = await api(request, response, url, generatePlan, generateAssistant); if (!handled) fail(response, 404, "API route not found"); return; }
    if (request.method !== "GET" && request.method !== "HEAD") return fail(response, 405, "Method not allowed");
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname; const filePath = path.normalize(path.join(root, requestedPath));
    if (!filePath.startsWith(root + path.sep)) return fail(response, 403, "Forbidden");
    if (!publicFiles.has(path.relative(root, filePath))) return fail(response, 404, "Not found");
    fs.readFile(filePath, (error, file) => { if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500); return response.end(error.code === "ENOENT" ? "Not found" : "Server error"); } response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" }); response.end(file); });
  } catch (error) { console.error(error); if (!response.headersSent) fail(response, error.status || 500, error.status ? error.message : "Internal server error"); }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
return server;
}

function startupGuard() {
  const missing = ["DATABASE_URL", "OPENAI_API_KEY"].filter(name => !process.env[name] || /^your_|^https?:\/\//.test(process.env[name]));
  if (missing.length) throw new Error(`Startup blocked: set ${missing.join(", ")} to server-side values before running the app.`);
  if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL)) throw new Error("Startup blocked: DATABASE_URL must be a Postgres connection string.");
}

if (require.main === module) { startupGuard(); createServer().listen(port, () => console.log(`First Dollar is running at http://localhost:${port}`)); }

module.exports = { createServer, startupGuard, placeholderAssistant, validateAssistantPayload, memoryRecordIds, fullMemory };
