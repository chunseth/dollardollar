const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { Pool } = require("pg");
require("../env").loadEnv();
const { requireDatabaseUrl } = require("../scripts/require_database_url");

const databaseUrl = requireDatabaseUrl("Conversation migration runner test");

function runMigrations() {
  return execFileSync(process.execPath, [path.join(__dirname, "../scripts/migrate.js")], { cwd: path.join(__dirname, ".."), env: process.env, encoding: "utf8" });
}

test("migration runner applies 003_conversation_loop.sql and safely reruns it", async () => {
  assert.match(runMigrations(), /Applying 003_conversation_loop\.sql/);
  assert.match(runMigrations(), /Applying 003_conversation_loop\.sql/);
  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  try {
    const objects = await pool.query("SELECT to_regclass(name) AS object_name FROM unnest(ARRAY['conversation_sessions', 'context_packets', 'conversation_turns', 'recommendations', 'recommendations_one_active_per_project_idx']) AS name");
    assert.equal(objects.rows.every(row => row.object_name), true, JSON.stringify(objects.rows));
  } finally {
    await pool.end();
  }
});
