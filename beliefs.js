const { query, transaction } = require("./db");

const isExecutor = value => value && typeof value.query === "function";
const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

function assumptionVersion(assumption, provenance = {}) {
  return {
    statement: assumption.statement,
    classification: assumption.category,
    validation_status: assumption.status,
    confidence: assumption.confidence,
    importance: assumption.importance,
    scope: provenance.scope || {},
    rationale: assumption.subcategory || null,
    source_event_id: provenance.source_event_id || null,
    source_turn_id: provenance.source_turn_id || null,
    source_user_id: provenance.source_user_id || null,
    source_assumption_id: assumption.id,
    source_identifier: provenance.source_identifier || assumption.source || null,
    provenance: provenance.provenance || {}
  };
}

async function assumptionFor(client, assumption) {
  if (typeof assumption !== "string") return assumption;
  const result = await client.query("SELECT * FROM assumptions WHERE id=$1", [assumption]);
  if (!result.rowCount) throw new Error("Assumption not found");
  return result.rows[0];
}

async function createBeliefFromAssumption(first, second, third) {
  if (!isExecutor(first)) return transaction(client => createBeliefFromAssumption(client, first, second));
  const client = first, assumption = await assumptionFor(client, second), provenance = third || {};
  const existing = await client.query("SELECT id FROM beliefs WHERE origin_assumption_id=$1", [assumption.id]);
  if (existing.rowCount) return beliefById(client, existing.rows[0].id);
  const belief = (await client.query("INSERT INTO beliefs (project_id,origin_assumption_id) VALUES ($1,$2) RETURNING *", [assumption.project_id, assumption.id])).rows[0];
  const version = assumptionVersion(assumption, provenance);
  const inserted = (await client.query(
    "INSERT INTO belief_versions (belief_id,version_number,statement,classification,validation_status,confidence,importance,scope,rationale,source_event_id,source_turn_id,source_user_id,source_assumption_id,source_identifier,provenance) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
    [belief.id, version.statement, version.classification, version.validation_status, version.confidence, version.importance, version.scope, version.rationale, version.source_event_id, version.source_turn_id, version.source_user_id, version.source_assumption_id, version.source_identifier, version.provenance]
  )).rows[0];
  await client.query("UPDATE beliefs SET current_version_id=$1 WHERE id=$2", [inserted.id, belief.id]);
  const { id: version_id, ...versionFields } = inserted;
  return { ...belief, current_version_id: version_id, version_id, ...versionFields };
}

async function beliefById(client, beliefId) {
  const result = await client.query("SELECT b.*, bv.statement, bv.classification, bv.validation_status, bv.confidence, bv.importance, bv.scope, bv.rationale, bv.version_number, bv.created_at AS version_created_at FROM beliefs b JOIN belief_versions bv ON bv.id=b.current_version_id WHERE b.id=$1", [beliefId]);
  if (!result.rowCount) throw new Error("Belief not found");
  return result.rows[0];
}

async function appendBeliefVersion(first, second, third) {
  if (!isExecutor(first)) return transaction(client => appendBeliefVersion(client, first, second));
  const client = first, beliefId = second, changes = third || {};
  const current = await client.query("SELECT b.id, b.is_active, bv.* FROM beliefs b JOIN belief_versions bv ON bv.id=b.current_version_id WHERE b.id=$1 FOR UPDATE", [beliefId]);
  if (!current.rowCount) throw new Error("Belief not found");
  const prior = current.rows[0];
  const value = key => has(changes, key) ? changes[key] : prior[key];
  const nextNumber = Number(prior.version_number) + 1;
  const inserted = (await client.query(
    "INSERT INTO belief_versions (belief_id,version_number,statement,classification,validation_status,confidence,importance,scope,rationale,source_event_id,source_turn_id,source_user_id,source_assumption_id,source_identifier,provenance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",
    [beliefId, nextNumber, value("statement"), value("classification"), value("validation_status"), value("confidence"), value("importance"), value("scope"), value("rationale"), value("source_event_id"), value("source_turn_id"), value("source_user_id"), value("source_assumption_id"), value("source_identifier"), value("provenance")]
  )).rows[0];
  await client.query("UPDATE beliefs SET current_version_id=$1, is_active=$2 WHERE id=$3", [inserted.id, has(changes, "is_active") ? changes.is_active : prior.is_active, beliefId]);
  return inserted;
}

async function linkEvidenceToBeliefVersion(first, second, third, fourth) {
  if (!isExecutor(first)) return transaction(client => linkEvidenceToBeliefVersion(client, first, second, third));
  const client = first, beliefVersionId = second, evidenceId = third, options = fourth || {};
  const ownership = await client.query("SELECT b.project_id AS belief_project_id, e.project_id AS evidence_project_id FROM belief_versions bv JOIN beliefs b ON b.id=bv.belief_id CROSS JOIN evidence e WHERE bv.id=$1 AND e.id=$2", [beliefVersionId, evidenceId]);
  if (!ownership.rowCount || ownership.rows[0].belief_project_id !== ownership.rows[0].evidence_project_id) throw new Error("Belief version and evidence must belong to the same project");
  const relationship = options.relationship || "neutral";
  if (!["supports", "contradicts", "mixed", "neutral"].includes(relationship)) throw new Error("Invalid belief evidence relationship");
  return (await client.query("INSERT INTO belief_evidence_links (belief_version_id,evidence_id,relationship,explanation,provenance) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (belief_version_id,evidence_id) DO UPDATE SET relationship=EXCLUDED.relationship, explanation=EXCLUDED.explanation, provenance=EXCLUDED.provenance RETURNING *", [beliefVersionId, evidenceId, relationship, options.explanation || null, options.provenance || {}])).rows[0];
}

async function currentBeliefsForProject(first, second) {
  if (!isExecutor(first)) return currentBeliefsForProject({ query }, first);
  const result = await first.query("SELECT b.id, b.project_id, b.origin_assumption_id, b.current_version_id, b.is_active, b.created_at, bv.version_number, bv.statement, bv.classification, bv.validation_status, bv.confidence, bv.importance, bv.scope, bv.rationale, bv.source_event_id, bv.source_turn_id, bv.source_user_id, bv.source_assumption_id, bv.source_identifier, bv.provenance, bv.created_at AS version_created_at FROM beliefs b JOIN belief_versions bv ON bv.id=b.current_version_id WHERE b.project_id=$1 AND b.is_active=true ORDER BY bv.created_at DESC", [second]);
  return result.rows;
}

module.exports = { createBeliefFromAssumption, appendBeliefVersion, linkEvidenceToBeliefVersion, currentBeliefsForProject };
