import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql, type Sql } from "@/lib/db";

type OpenResult =
  | { ok: true; token: string; user: { id: string; name: string; email: string } }
  | { ok: false; message: string };

type LegacyUser = { id: string; name: string; email: string; password: string };
type LegacySession = { token: string; userId: string; expiresAt: number };

const imported = globalThis as typeof globalThis & { __accountsImported?: boolean };

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function checkPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

async function importLegacyFile(sql: Sql) {
  if (imported.__accountsImported) return;
  imported.__accountsImported = true;
  try {
    const raw = readFileSync(join(process.cwd(), ".data", "email-accounts.json"), "utf8");
    const parsed = JSON.parse(raw) as { users?: LegacyUser[]; sessions?: LegacySession[] };
    for (const user of parsed.users ?? []) {
      await sql.query(
        `insert into app_users (id, name, email, password_hash)
         values ($1, $2, $3, $4)
         on conflict (email) do nothing`,
        [user.id, user.name, user.email, user.password],
      );
    }
    const now = Date.now();
    for (const session of parsed.sessions ?? []) {
      if (session.expiresAt <= now) continue;
      await sql.query(
        `insert into app_sessions (token, user_id, expires_at)
         values ($1, $2, $3)
         on conflict (token) do nothing`,
        [session.token, session.userId, new Date(session.expiresAt).toISOString()],
      );
    }
  } catch {
    /* no preview file to import */
  }
}

export async function findAccountUser(token: string | null | undefined): Promise<{ id: string; email: string } | null> {
  if (!token) return null;
  const sql = await getSql();
  await importLegacyFile(sql);
  const rows = await sql.query<{ id: string; email: string }>(
    `select u.id, u.email
     from app_sessions s
     join app_users u on u.id = s.user_id
     where s.token = $1 and s.expires_at > now()
     limit 1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function openEmailAccount(input: {
  email: string;
  password: string;
  name: string;
  mode: string;
}): Promise<OpenResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim();
  if (!email.includes("@") || email.length > 120) return { ok: false, message: "Invalid email" };
  if (password.length < 8 || password.length > 200) return { ok: false, message: "Password too short" };

  const sql = await getSql();
  await importLegacyFile(sql);
  const existing = await sql.query<{ id: string; name: string; email: string; password_hash: string }>(
    `select id, name, email, password_hash from app_users where email = $1 limit 1`,
    [email],
  );
  const found = existing[0];

  if (input.mode === "signin" || input.mode === "reset") {
    if (!found) return { ok: false, message: "No account" };
    if (input.mode === "signin" && !checkPassword(password, found.password_hash)) {
      return { ok: false, message: "Invalid email or password" };
    }
    if (input.mode === "reset") {
      await sql.query(`update app_users set password_hash = $1 where id = $2`, [hashPassword(password), found.id]);
    }
    const token = await startSession(sql, found.id);
    return { ok: true, token, user: { id: found.id, name: found.name, email: found.email } };
  }
  if (found) {
    if (checkPassword(password, found.password_hash)) {
      const token = await startSession(sql, found.id);
      return { ok: true, token, user: { id: found.id, name: found.name, email: found.email } };
    }
    return { ok: false, message: "User already exists. Use another email." };
  }

  const id = randomBytes(16).toString("hex");
  const display = name || email.split("@")[0] || email;
  await sql.query(
    `insert into app_users (id, name, email, password_hash) values ($1, $2, $3, $4)`,
    [id, display, email, hashPassword(password)],
  );
  const token = await startSession(sql, id);
  return { ok: true, token, user: { id, name: display, email } };
}

async function startSession(sql: Sql, userId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await sql.query(
    `insert into app_sessions (token, user_id, expires_at) values ($1, $2, now() + interval '14 days')`,
    [token, userId],
  );
  return token;
}
