const test = require("node:test");
const assert = require("node:assert/strict");
require("../env").loadEnv();
const { requireDatabaseUrl } = require("../scripts/require_database_url");
const { Pool } = require("pg");
const { createBeliefFromAssumption, appendBeliefVersion, linkEvidenceToBeliefVersion, currentBeliefsForProject } = require("../beliefs");

const databaseUrl = requireDatabaseUrl("Belief service tests");
const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });

test.after(async () => { await pool.end(); });

async function fixture(label) {
  const project = (await pool.query("INSERT INTO projects (user_id,name) VALUES ($1,$2) RETURNING *", [`belief-test-${Date.now()}-${label}`, `Belief ${label}`])).rows[0];
  const assumption = (await pool.query("INSERT INTO assumptions (project_id,statement,category,status,confidence,importance,subcategory,source) VALUES ($1,$2,'problem','untested','low',4,'Initial rationale','founder') RETURNING *", [project.id, "At least 3 of 10 founders will describe the workflow as painful."])).rows[0];
  return { project, assumption };
}

test("belief services create, append, scope current beliefs, and retain prior versions", async t => {
  const { project, assumption } = await fixture("versions");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [project.id]));
  const belief = await createBeliefFromAssumption(assumption, { source_identifier: "test" }, { projectId: project.id });
  assert.equal(belief.version_number, 1);
  assert.equal(belief.is_active, true);
  assert.equal(belief.statement, assumption.statement);
  const next = await appendBeliefVersion(belief.id, { statement: "At least 4 of 10 founders will describe the workflow as painful.", classification: "hypothesis", provenance: { test: true } });
  assert.equal(next.version_number, 2);
  const versions = await pool.query("SELECT version_number, statement FROM belief_versions WHERE belief_id=$1 ORDER BY version_number", [belief.id]);
  assert.deepEqual(versions.rows.map(row => row.version_number), [1, 2]);
  assert.equal(versions.rows[0].statement, assumption.statement);
  const current = await currentBeliefsForProject(project.id);
  assert.equal(current.length, 1);
  assert.equal(current[0].current_version_id, next.id);
  assert.equal(current[0].classification, "hypothesis");
  const inactiveAssumption = (await pool.query("INSERT INTO assumptions (project_id,statement,category) VALUES ($1,$2,'solution') RETURNING *", [project.id, "At least 3 of 10 founders will use the concierge workflow weekly."])).rows[0];
  const inactiveBelief = await createBeliefFromAssumption(inactiveAssumption, {}, { projectId: project.id });
  await appendBeliefVersion(inactiveBelief.id, { is_active: false });
  assert.equal((await currentBeliefsForProject(project.id)).length, 1);
  const other = await fixture("other-project");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [other.project.id]));
  await createBeliefFromAssumption(other.assumption, {}, { projectId: other.project.id });
  assert.equal((await currentBeliefsForProject(project.id)).length, 1);
});

test("belief services reject cross-project assumptions", async t => {
  const local = await fixture("local-assumption");
  const foreign = await fixture("foreign-assumption");
  t.after(() => Promise.all([local, foreign].map(({ project }) => pool.query("DELETE FROM projects WHERE id=$1", [project.id]))));
  await assert.rejects(() => createBeliefFromAssumption(foreign.assumption.id, {}, { projectId: local.project.id }), /expected project/);
  await assert.rejects(() => createBeliefFromAssumption(foreign.assumption, { expectedProjectId: local.project.id }), /expected project/);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM beliefs WHERE origin_assumption_id=$1", [foreign.assumption.id])).rows[0].count, 0);
});

test("createBeliefFromAssumption requires an expected project context", async t => {
  const { project, assumption } = await fixture("missing-project-context");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [project.id]));
  await assert.rejects(() => createBeliefFromAssumption(assumption), /requires projectId/);
});

test("appendBeliefVersion rejects a cross-project source assumption", async t => {
  const local = await fixture("local-source");
  const foreign = await fixture("foreign-source");
  t.after(() => Promise.all([local, foreign].map(({ project }) => pool.query("DELETE FROM projects WHERE id=$1", [project.id]))));
  const belief = await createBeliefFromAssumption(local.assumption, {}, { projectId: local.project.id });
  await assert.rejects(() => appendBeliefVersion(belief.id, { source_assumption_id: foreign.assumption.id }), /same project/);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM belief_versions WHERE belief_id=$1", [belief.id])).rows[0].count, 1);
});

test("evidence links target the exact belief version and reject cross-project evidence", async t => {
  const { project, assumption } = await fixture("evidence");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [project.id]));
  const belief = await createBeliefFromAssumption(assumption, {}, { projectId: project.id });
  const evidence = (await pool.query("INSERT INTO evidence (project_id,source_type,source_title,summary) VALUES ($1,'interview','Call','Founder described the pain') RETURNING *", [project.id])).rows[0];
  const link = await linkEvidenceToBeliefVersion(belief.current_version_id, evidence.id, { relationship: "supports" });
  assert.equal(link.belief_version_id, belief.current_version_id);
  const other = await fixture("cross-project");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [other.project.id]));
  const foreignEvidence = (await pool.query("INSERT INTO evidence (project_id,source_type,source_title,summary) VALUES ($1,'interview','Other call','Other project') RETURNING *", [other.project.id])).rows[0];
  await assert.rejects(() => linkEvidenceToBeliefVersion(belief.current_version_id, foreignEvidence.id), /same project/);
});
