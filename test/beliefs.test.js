const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
require("../env").loadEnv();
const { requireDatabaseUrl } = require("../scripts/require_database_url");
const { Pool } = require("pg");
const { createBeliefFromAssumption, appendBeliefVersion, linkEvidenceToBeliefVersion, currentBeliefsForProject } = require("../beliefs");

const databaseUrl = requireDatabaseUrl("Belief service tests");
const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });

test.before(() => {
  execFileSync(process.execPath, [path.join(__dirname, "../scripts/migrate.js")], { cwd: path.join(__dirname, ".."), env: process.env, encoding: "utf8" });
});
test.after(async () => { await pool.end(); });

async function fixture(label) {
  const project = (await pool.query("INSERT INTO projects (user_id,name) VALUES ($1,$2) RETURNING *", [`belief-test-${Date.now()}-${label}`, `Belief ${label}`])).rows[0];
  const assumption = (await pool.query("INSERT INTO assumptions (project_id,statement,category,status,confidence,importance,subcategory,source) VALUES ($1,$2,'problem','untested','low',4,'Initial rationale','founder') RETURNING *", [project.id, "At least 3 of 10 founders will describe the workflow as painful."])).rows[0];
  return { project, assumption };
}

test("belief services create, append, scope current beliefs, and retain prior versions", async t => {
  const { project, assumption } = await fixture("versions");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [project.id]));
  const belief = await createBeliefFromAssumption(assumption, { source_identifier: "test" });
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
  const inactiveBelief = await createBeliefFromAssumption(inactiveAssumption);
  await appendBeliefVersion(inactiveBelief.id, { is_active: false });
  assert.equal((await currentBeliefsForProject(project.id)).length, 1);
  const other = await fixture("other-project");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [other.project.id]));
  await createBeliefFromAssumption(other.assumption);
  assert.equal((await currentBeliefsForProject(project.id)).length, 1);
});

test("evidence links target the exact belief version and reject cross-project evidence", async t => {
  const { project, assumption } = await fixture("evidence");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [project.id]));
  const belief = await createBeliefFromAssumption(assumption);
  const evidence = (await pool.query("INSERT INTO evidence (project_id,source_type,source_title,summary) VALUES ($1,'interview','Call','Founder described the pain') RETURNING *", [project.id])).rows[0];
  const link = await linkEvidenceToBeliefVersion(belief.current_version_id, evidence.id, { relationship: "supports" });
  assert.equal(link.belief_version_id, belief.current_version_id);
  const other = await fixture("cross-project");
  t.after(() => pool.query("DELETE FROM projects WHERE id=$1", [other.project.id]));
  const foreignEvidence = (await pool.query("INSERT INTO evidence (project_id,source_type,source_title,summary) VALUES ($1,'interview','Other call','Other project') RETURNING *", [other.project.id])).rows[0];
  await assert.rejects(() => linkEvidenceToBeliefVersion(belief.current_version_id, foreignEvidence.id), /same project/);
});
