require("../env").loadEnv();
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");

const migrationLockId = 9112026;

(async () => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    const migrations = fs.readdirSync(path.join(__dirname, "../migrations")).filter(file => file.endsWith(".sql")).sort();
    for (const file of migrations) {
      console.log(`Applying ${file}`);
      await client.query(fs.readFileSync(path.join(__dirname, "../migrations", file), "utf8"));
    }
    console.log("Migrations complete.");
  } finally {
    try { await client.query("SELECT pg_advisory_unlock($1)", [migrationLockId]); }
    finally { client.release(); await pool.end(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
