// Use local PostgreSQL for tests (no internet access in CI sandbox).
// The local DB must have the schema applied (via `drizzle-kit push` with local URL).
process.env.DATABASE_URL = "postgresql://testuser:testpass@127.0.0.1:5432/testdb";

// Strip surrounding quotes from env vars that shell quoting may have included literally.
function stripQuotes(key: string) {
  const val = process.env[key];
  if (!val) return;
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    process.env[key] = val.slice(1, -1);
  }
}

stripQuotes("ENCRYPTION_KEY");
stripQuotes("SESSION_SECRET");
