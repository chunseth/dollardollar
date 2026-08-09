const test = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
require("../env").loadEnv();
const { requireDatabaseUrl } = require("../scripts/require_database_url");

const databaseUrl = requireDatabaseUrl("Conversation migration runner test");

test("conversation and belief migration objects exist in the configured database", async () => {
  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  try {
    const objects = await pool.query("SELECT to_regclass(name) AS object_name FROM unnest(ARRAY['conversation_sessions', 'context_packets', 'conversation_turns', 'recommendations', 'recommendations_one_active_per_project_idx', 'beliefs', 'belief_versions', 'belief_evidence_links']) AS name");
    assert.equal(objects.rows.every(row => row.object_name), true, JSON.stringify(objects.rows));
  } finally {
    await pool.end();
  }
});
