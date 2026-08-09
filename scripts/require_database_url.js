function requireDatabaseUrl(scope) {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error(`${scope} requires DATABASE_URL. Load the target test environment before running tests (for example: set -a; source .env; set +a).`);
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error(`${scope} requires DATABASE_URL to be a Postgres connection string.`);
  return value;
}

module.exports = { requireDatabaseUrl };
