const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
require("../env").loadEnv();
const { requireDatabaseUrl } = require("../scripts/require_database_url");

const databaseUrl = requireDatabaseUrl("Conversation migration runner test");

test("conversation, belief, and change-set migration objects exist in the configured database", async () => {
  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  try {
    const objects = await pool.query("SELECT to_regclass(name) AS object_name FROM unnest(ARRAY['conversation_sessions', 'context_packets', 'conversation_turns', 'recommendations', 'recommendations_one_active_per_project_idx', 'recommendations_project_version_idx', 'recommendations_project_history_idx', 'recommendations_supersedes_idx', 'beliefs', 'belief_versions', 'belief_evidence_links', 'change_sets', 'change_set_items', 'change_sets_project_pending_review_idx', 'change_sets_project_lifecycle_idx', 'change_set_items_change_set_review_idx']) AS name");
    assert.equal(objects.rows.every(row => row.object_name), true, JSON.stringify(objects.rows));
    const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='recommendations' AND column_name IN ('version','supersedes_id','primary_issue_id','state')");
    assert.deepEqual(columns.rows.map(row => row.column_name).sort(), ['primary_issue_id', 'state', 'supersedes_id', 'version']);
    const indexes = await pool.query("SELECT c.relname, i.indisunique, pg_get_expr(i.indpred, i.indrelid) AS predicate FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid WHERE c.relname IN ('recommendations_one_active_per_project_idx', 'recommendations_project_version_idx') ORDER BY c.relname");
    assert.deepEqual(indexes.rows, [
      { relname: "recommendations_one_active_per_project_idx", indisunique: true, predicate: "(status = 'active'::text)" },
      { relname: "recommendations_project_version_idx", indisunique: true, predicate: null }
    ]);
    const migration = fs.readFileSync(path.join(__dirname, "../migrations/006_deterministic_recommendations.sql"), "utf8");
    assert.match(migration, /ROW_NUMBER\(\) OVER \(\s*PARTITION BY project_id\s*ORDER BY created_at ASC, id ASC/);
    assert.match(migration, /supersedes_id[\s\S]*intended equivalent of a superseded_by forward link/);
  } finally {
    await pool.end();
  }
});
