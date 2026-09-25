import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** DATABASE_URL from the environment, or from the server-only `.env` file. */
export function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      if (trimmed.slice(0, eq).trim() !== "DATABASE_URL") continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value.trim()) return value.trim();
    }
  } catch {
    /* no local .env */
  }
  return undefined;
}

/**
 * node-postgres settings for Neon or Supabase.
 * Supabase requires SSL. Use the Session pooler URI (port 5432), not the
 * direct host — the direct host is often IPv6-only.
 */
export function poolConfig(connectionString) {
  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    host = "";
  }
  const supabase = host.includes("supabase.");
  const ssl = supabase || /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined;
  return { connectionString, max: 1, ssl };
}
