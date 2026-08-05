const http = require("http");
const fs = require("fs");
const path = require("path");
const { query, transaction } = require("./db");

const root = __dirname;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const port = Number(process.env.PORT) || 3000;
const entities = {
  assumptions: { table: "assumptions", required: ["statement", "category"], fields: ["statement", "category", "subcategory", "status", "priority", "confidence", "source", "owner", "importance", "uncertainty", "risk_score", "revenue_blocker"] },
  evidence: { table: "evidence", required: ["source_type", "source_title", "summary"], fields: ["source_type", "source_title", "summary", "raw_text", "source_date", "source_person_name", "source_company", "strength", "confidence", "specificity", "recency", "bias_risk", "willingness_to_pay_signal", "behavior_vs_opinion"] },
  experiments: { table: "experiments", required: ["title", "hypothesis", "success_metric"], fields: ["assumption_id", "title", "hypothesis", "test_design", "success_metric", "success_threshold", "status", "expected_duration", "owner", "started_at", "completed_at"] },
  tasks: { table: "tasks", required: ["title"], fields: ["experiment_id", "assumption_id", "title", "description", "priority", "status", "due_date", "estimated_minutes", "impact_level", "effort_level", "source"] },
  decisions: { table: "decisions", required: ["title", "decision"], fields: ["title", "decision", "reason", "status", "decided_at"] }
};
const projectFields = ["name", "short_description", "long_description", "stage", "status", "target_customer", "problem_statement", "solution_summary", "revenue_model", "pricing_hypothesis", "validation_stage", "project_memory_summary", "founder_goal", "founder_constraints"];
const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
const singular = entity => ({ evidence: "evidence" })[entity] || entity.slice(0, -1);
const userId = request => request.headers["x-user-id"] || "local-founder";
const send = (response, status, data) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(data)); return true; };
const fail = (response, status, message, details) => send(response, status, { error: message, ...(details ? { details } : {}) });
const pick = (body, fields) => Object.fromEntries(fields.filter(field => body[field] !== undefined).map(field => [field, body[field]]));

function validate(entity, values, partial = false) {
  const definition = entities[entity]; const errors = {};
  if (!partial) definition.required.forEach(field => { if (typeof values[field] !== "string" || !values[field].trim()) errors[field] = "is required"; });
  if (values.estimated_minutes !== undefined && (!Number.isInteger(values.estimated_minutes) || values.estimated_minutes < 1)) errors.estimated_minutes = "must be a positive integer";
  if (values.risk_score !== undefined && (!Number.isInteger(values.risk_score) || values.risk_score < 0 || values.risk_score > 100)) errors.risk_score = "must be an integer from 0 to 100";
  if (values.importance !== undefined && (!Number.isInteger(values.importance) || values.importance < 1 || values.importance > 5)) errors.importance = "must be an integer from 1 to 5";
  if (values.uncertainty !== undefined && (!Number.isInteger(values.uncertainty) || values.uncertainty < 1 || values.uncertainty > 5)) errors.uncertainty = "must be an integer from 1 to 5";
  return Object.keys(errors).length ? errors : null;
}
async function readBody(request) { let body = ""; for await (const chunk of request) { body += chunk; if (body.length > 1_000_000) throw new Error("Request body is too large"); } try { return body ? JSON.parse(body) : {}; } catch { const error = new Error("Request body must be valid JSON"); error.status = 400; throw error; } }
async function log(client, projectId, actorType, eventType, entityType, entityId, summary, payload = {}) { await client.query("INSERT INTO event_log (project_id, actor_type, event_type, entity_type, entity_id, summary, payload) VALUES ($1,$2,$3,$4,$5,$6,$7)", [projectId, actorType, eventType, entityType, entityId, summary, payload]); }
async function ownedProject(projectId, owner) { const result = await query("SELECT * FROM projects WHERE id=$1 AND user_id=$2", [projectId, owner]); return result.rows[0]; }
async function fullMemory(projectId) {
  const [project, assumptions, evidence, experiments, tasks, decisions, links, events] = await Promise.all([
    query("SELECT * FROM projects WHERE id=$1", [projectId]), query("SELECT * FROM assumptions WHERE project_id=$1 ORDER BY risk_score DESC, created_at", [projectId]), query("SELECT * FROM evidence WHERE project_id=$1 ORDER BY created_at DESC", [projectId]), query("SELECT * FROM experiments WHERE project_id=$1 ORDER BY created_at DESC", [projectId]), query("SELECT * FROM tasks WHERE project_id=$1 ORDER BY created_at", [projectId]), query("SELECT * FROM decisions WHERE project_id=$1 ORDER BY created_at DESC", [projectId]), query("SELECT ae.* FROM assumption_evidence ae JOIN evidence e ON e.id=ae.evidence_id WHERE e.project_id=$1", [projectId]), query("SELECT * FROM event_log WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50", [projectId])
  ]);
  return { project: project.rows[0], assumptions: assumptions.rows, evidence: evidence.rows, experiments: experiments.rows, tasks: tasks.rows, decisions: decisions.rows, assumption_evidence: links.rows, events: events.rows };
}

async function api(request, response, url) {
  const parts = url.pathname.split("/").filter(Boolean); const method = request.method; const owner = userId(request);
  if (parts[1] !== "projects") return false;
  if (parts.length === 2 && method === "GET") return send(response, 200, { projects: (await query("SELECT * FROM projects WHERE user_id=$1 ORDER BY updated_at DESC", [owner])).rows });
  if (parts.length === 2 && method === "POST") { const body = await readBody(request); const values = pick(body, projectFields); if (!values.name || !String(values.name).trim()) return fail(response, 422, "Invalid project", { name: "is required" }); const result = await transaction(async client => { const fields = ["user_id", ...Object.keys(values)], params = [owner, ...Object.values(values)]; const row = (await client.query(`INSERT INTO projects (${fields.join(",")}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, params)).rows[0]; await log(client, row.id, "founder", "created", "project", row.id, `Created project ${row.name}`, values); return row; }); return send(response, 201, { project: result }); }
  const projectId = parts[2]; if (!validUuid(projectId) || !(await ownedProject(projectId, owner))) return fail(response, 404, "Project not found");
  if (parts[3] === "memory" && method === "GET") return send(response, 200, await fullMemory(projectId));
  if (parts.length === 3 && method === "PATCH") { const body = await readBody(request); const values = pick(body, projectFields); if (!Object.keys(values).length) return fail(response, 422, "No editable project fields supplied"); const row = await transaction(async client => { const entries = Object.entries(values); const result = await client.query(`UPDATE projects SET ${entries.map(([field], index) => `${field}=$${index + 1}`).join(",")} WHERE id=$${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), projectId]); await log(client, projectId, "founder", "updated", "project", projectId, "Updated company memory", values); return result.rows[0]; }); return send(response, 200, { project: row }); }
  if (parts.length === 3 && method === "DELETE") { await transaction(async client => { await log(client, projectId, "founder", "deleted", "project", projectId, "Deleted project"); await client.query("DELETE FROM projects WHERE id=$1", [projectId]); }); response.writeHead(204); response.end(); return true; }
  const entity = parts[3]; const definition = entities[entity];
  if (definition && parts.length === 4 && method === "GET") return send(response, 200, { [entity]: (await query(`SELECT * FROM ${definition.table} WHERE project_id=$1 ORDER BY created_at DESC`, [projectId])).rows });
  if (definition && parts.length === 4 && method === "POST") { const body = await readBody(request); const values = pick(body, definition.fields); const errors = validate(entity, values), entityName = singular(entity); if (errors) return fail(response, 422, "Invalid " + entityName, errors); const row = await transaction(async client => { const fields = ["project_id", ...Object.keys(values)], params = [projectId, ...Object.values(values)]; const result = await client.query(`INSERT INTO ${definition.table} (${fields.join(",")}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, params); const record = result.rows[0]; await log(client, projectId, "founder", "created", entityName, record.id, `Created ${entityName}: ${record.title || record.statement || record.source_title}`, values); return record; }); return send(response, 201, { [entityName]: row }); }
  const entityId = parts[4];
  if (definition && validUuid(entityId) && parts.length === 5 && (method === "PATCH" || method === "DELETE")) {
    const exists = await query(`SELECT id FROM ${definition.table} WHERE id=$1 AND project_id=$2`, [entityId, projectId]); if (!exists.rowCount) return fail(response, 404, "Record not found");
    if (method === "DELETE") { const entityName = singular(entity); await transaction(async client => { await client.query(`DELETE FROM ${definition.table} WHERE id=$1`, [entityId]); await log(client, projectId, "founder", "deleted", entityName, entityId, `Deleted ${entityName}`); }); response.writeHead(204); response.end(); return true; }
    const body = await readBody(request), values = pick(body, definition.fields), errors = validate(entity, values, true); if (errors || !Object.keys(values).length) return fail(response, 422, "Invalid update", errors || { body: "No editable fields supplied" });
    const entityName = singular(entity); const row = await transaction(async client => { const entries = Object.entries(values); const result = await client.query(`UPDATE ${definition.table} SET ${entries.map(([field], index) => `${field}=$${index + 1}`).join(",")} WHERE id=$${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), entityId]); await log(client, projectId, "founder", "updated", entityName, entityId, `Updated ${entityName}`, values); return result.rows[0]; }); return send(response, 200, { [entityName]: row });
  }
  if (parts[3] === "assumption-evidence" && method === "POST") { const body = await readBody(request); if (!validUuid(body.assumption_id) || !validUuid(body.evidence_id) || !["supports", "contradicts", "neutral"].includes(body.relationship)) return fail(response, 422, "Invalid relationship"); const result = await transaction(async client => { const check = await client.query("SELECT (SELECT project_id FROM assumptions WHERE id=$1) assumption_project, (SELECT project_id FROM evidence WHERE id=$2) evidence_project", [body.assumption_id, body.evidence_id]); if (!check.rows[0] || check.rows[0].assumption_project !== projectId || check.rows[0].evidence_project !== projectId) { const error = new Error("Linked records must belong to this project"); error.status = 422; throw error; } const row = (await client.query("INSERT INTO assumption_evidence (assumption_id,evidence_id,relationship,explanation) VALUES ($1,$2,$3,$4) ON CONFLICT (assumption_id,evidence_id) DO UPDATE SET relationship=EXCLUDED.relationship, explanation=EXCLUDED.explanation RETURNING *", [body.assumption_id, body.evidence_id, body.relationship, body.explanation || null])).rows[0]; await log(client, projectId, "founder", "linked", "assumption_evidence", row.id, "Linked evidence to assumption", body); return row; }); return send(response, 201, { link: result }); }
  if (parts[3] === "relationships" && method === "POST") { const body = await readBody(request); const maps = { assumption_experiment: ["assumption_id", "experiment_id"], evidence_experiment: ["evidence_id", "experiment_id"], task_experiment: ["task_id", "experiment_id"], task_assumption: ["task_id", "assumption_id"] }; const columns = maps[body.type]; if (!columns || columns.some(column => !validUuid(body[column]))) return fail(response, 422, "Invalid relationship"); const result = await transaction(async client => { const ids = Object.values(body).filter(validUuid); const ownership = await client.query("SELECT count(*)::int AS count FROM (SELECT id FROM assumptions WHERE project_id=$1 AND id = ANY($2::uuid[]) UNION SELECT id FROM evidence WHERE project_id=$1 AND id = ANY($2::uuid[]) UNION SELECT id FROM experiments WHERE project_id=$1 AND id = ANY($2::uuid[]) UNION SELECT id FROM tasks WHERE project_id=$1 AND id = ANY($2::uuid[])) records", [projectId, ids]); if (ownership.rows[0].count !== columns.length) { const error = new Error("Linked records must belong to this project"); error.status = 422; throw error; } const params = columns.map(column => body[column]); const row = (await client.query(`WITH inserted AS (INSERT INTO ${body.type} (${columns.join(",")}) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *, true AS created) SELECT * FROM inserted UNION ALL SELECT *, false AS created FROM ${body.type} WHERE ${columns[0]}=$1 AND ${columns[1]}=$2 LIMIT 1`, params)).rows[0]; await log(client, projectId, "founder", "linked", body.type, null, `${row.created ? "Created" : "Reused"} ${body.type} link`, body); return row; }); return send(response, 201, { relationship: result }); }
  return false;
}

function createServer() {
return http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) { const handled = await api(request, response, url); if (!handled) fail(response, 404, "API route not found"); return; }
    if (request.method !== "GET" && request.method !== "HEAD") return fail(response, 405, "Method not allowed");
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname; const filePath = path.normalize(path.join(root, requestedPath));
    if (!filePath.startsWith(root + path.sep)) return fail(response, 403, "Forbidden");
    fs.readFile(filePath, (error, file) => { if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500); return response.end(error.code === "ENOENT" ? "Not found" : "Server error"); } response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(file); });
  } catch (error) { console.error(error); if (!response.headersSent) fail(response, error.status || 500, error.status ? error.message : "Internal server error"); }
});
}

if (require.main === module) createServer().listen(port, () => console.log(`First Dollar is running at http://localhost:${port}`));

module.exports = { createServer };
