import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql, type Sql } from "@/lib/db";
import QRCode from "qrcode";
import { sendMail, verificationLetter } from "./mail.server";
import { codesMatch, newEmailCode, newTotpSecret, otpauthUrl, verifyTotp } from "./otp.server";

type AccountUser = { id: string; name: string; email: string };

export type OpenResult =
  | { ok: true; token: string; user: AccountUser }
  | { ok: false; message: string; next?: "verify" | "mfa"; challenge?: string };

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

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  totp_secret: string | null;
  mfa_enabled: boolean;
};

async function findUser(sql: Sql, email: string): Promise<UserRow | undefined> {
  const rows = await sql.query<UserRow>(
    `select id, name, email, password_hash, email_verified, totp_secret, mfa_enabled
     from app_users where email = $1 limit 1`,
    [email],
  );
  return rows[0];
}

async function sendVerifyCode(sql: Sql, email: string): Promise<"sent" | "wait" | "mail"> {
  const recent = await sql.query<{ sent_at: string }>(
    `select sent_at from app_email_codes
     where email = $1 and purpose = 'verify' and sent_at > now() - interval '30 seconds'
     limit 1`,
    [email],
  );
  if (recent[0]) return "wait";
  const issued = newEmailCode();
  await sql.query(
    `insert into app_email_codes (email, purpose, code_hash, salt, sent_at, expires_at)
     values ($1, 'verify', $2, $3, now(), now() + interval '10 minutes')
     on conflict (email, purpose) do update
     set code_hash = excluded.code_hash, salt = excluded.salt, sent_at = now(), expires_at = excluded.expires_at`,
    [email, issued.hash, issued.salt],
  );
  const letter = verificationLetter(issued.code);
  const sent = await sendMail(email, letter.subject, letter.text);
  return sent.ok ? "sent" : "mail";
}

function verifyRedirect(delivery: "sent" | "wait" | "mail"): OpenResult {
  return {
    ok: false,
    message: delivery === "mail" ? "Mail failed" : "Verify email",
    next: "verify",
  };
}

async function signedIn(sql: Sql, user: UserRow): Promise<OpenResult> {
  const token = await startSession(sql, user.id);
  return { ok: true, token, user: { id: user.id, name: user.name, email: user.email } };
}

export async function openEmailAccount(input: {
  email: string;
  password: string;
  name: string;
  mode: string;
  code?: string;
  challenge?: string;
}): Promise<OpenResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const name = input.name.trim();
  const code = (input.code ?? "").trim();
  const sql = await getSql();
  await importLegacyFile(sql);

  if (input.mode === "verify") {
    if (!email.includes("@") || !/^\d{6}$/.test(code)) return { ok: false, message: "Bad code", next: "verify" };
    const rows = await sql.query<{ code_hash: string; salt: string }>(
      `select code_hash, salt from app_email_codes
       where email = $1 and purpose = 'verify' and expires_at > now() limit 1`,
      [email],
    );
    const pending = rows[0];
    if (!pending || !codesMatch(code, pending.salt, pending.code_hash)) {
      return { ok: false, message: "Bad code", next: "verify" };
    }
    await sql.query(`update app_users set email_verified = true where email = $1`, [email]);
    await sql.query(`delete from app_email_codes where email = $1 and purpose = 'verify'`, [email]);
    const user = await findUser(sql, email);
    if (!user) return { ok: false, message: "No account" };
    return signedIn(sql, user);
  }

  if (input.mode === "resend") {
    const user = await findUser(sql, email);
    if (!user) return { ok: false, message: "No account" };
    if (user.email_verified) return { ok: false, message: "Invalid email or password" };
    return verifyRedirect(await sendVerifyCode(sql, email));
  }

  if (input.mode === "mfa") {
    const challenge = (input.challenge ?? "").trim();
    const rows = await sql.query<{ user_id: string }>(
      `select user_id from app_mfa_challenges where id = $1 and expires_at > now() limit 1`,
      [challenge],
    );
    const pending = rows[0];
    if (!pending) return { ok: false, message: "Bad code", next: "mfa" };
    const users = await sql.query<UserRow>(
      `select id, name, email, password_hash, email_verified, totp_secret, mfa_enabled
       from app_users where id = $1 limit 1`,
      [pending.user_id],
    );
    const user = users[0];
    if (!user?.totp_secret || !verifyTotp(user.totp_secret, code)) {
      return { ok: false, message: "Bad code", next: "mfa", challenge };
    }
    await sql.query(`delete from app_mfa_challenges where id = $1`, [challenge]);
    return signedIn(sql, user);
  }

  if (!email.includes("@") || email.length > 120) return { ok: false, message: "Invalid email" };
  if (password.length < 8 || password.length > 200) return { ok: false, message: "Password too short" };

  const found = await findUser(sql, email);

  if (input.mode === "signin" || input.mode === "reset") {
    if (!found) return { ok: false, message: "No account" };
    if (input.mode === "signin" && !checkPassword(password, found.password_hash)) {
      return { ok: false, message: "Invalid email or password" };
    }
    if (input.mode === "reset") {
      await sql.query(`update app_users set password_hash = $1 where id = $2`, [hashPassword(password), found.id]);
    }
    if (!found.email_verified) return verifyRedirect(await sendVerifyCode(sql, email));
    if (found.mfa_enabled && found.totp_secret) {
      const challenge = randomBytes(16).toString("hex");
      await sql.query(
        `insert into app_mfa_challenges (id, user_id, expires_at) values ($1, $2, now() + interval '5 minutes')`,
        [challenge, found.id],
      );
      return { ok: false, message: "MFA required", next: "mfa", challenge };
    }
    return signedIn(sql, found);
  }

  if (found) {
    if (!found.email_verified && checkPassword(password, found.password_hash)) {
      return verifyRedirect(await sendVerifyCode(sql, email));
    }
    if (checkPassword(password, found.password_hash) && found.email_verified) return signedIn(sql, found);
    return { ok: false, message: "Invalid email or password" };
  }

  const id = randomBytes(16).toString("hex");
  const display = name || email.split("@")[0] || email;
  try {
    await sql.query(
      `insert into app_users (id, name, email, password_hash, email_verified) values ($1, $2, $3, $4, false)`,
      [id, display, email, hashPassword(password)],
    );
  } catch (error) {
    const again = await findUser(sql, email);
    if (again && !again.email_verified && checkPassword(password, again.password_hash)) {
      return verifyRedirect(await sendVerifyCode(sql, email));
    }
    if (again) return { ok: false, message: "Invalid email or password" };
    throw error;
  }
  return verifyRedirect(await sendVerifyCode(sql, email));
}

export type SecurityView = {
  email: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  secret: string | null;
  otpauth: string | null;
  qr: string | null;
};

async function userFromToken(token: string | null | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql.query<UserRow>(
    `select u.id, u.name, u.email, u.password_hash, u.email_verified, u.totp_secret, u.mfa_enabled
     from app_sessions s
     join app_users u on u.id = s.user_id
     where s.token = $1 and s.expires_at > now()
     limit 1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function securityView(token: string | null | undefined): Promise<SecurityView | null> {
  const user = await userFromToken(token);
  if (!user) return null;
  const pending = !user.mfa_enabled && user.totp_secret ? user.totp_secret : null;
  const otpauth = pending ? otpauthUrl(user.email, pending) : null;
  const qr = otpauth
    ? await QRCode.toDataURL(otpauth, { margin: 1, width: 320, errorCorrectionLevel: "M" })
    : null;
  return {
    email: user.email,
    emailVerified: user.email_verified,
    mfaEnabled: user.mfa_enabled,
    secret: pending,
    otpauth,
    qr,
  };
}

export async function beginMfa(token: string | null | undefined): Promise<SecurityView | null> {
  const user = await userFromToken(token);
  if (!user || user.mfa_enabled) return securityView(token);
  const secret = user.totp_secret || newTotpSecret();
  const sql = await getSql();
  await sql.query(`update app_users set totp_secret = $1 where id = $2`, [secret, user.id]);
  return securityView(token);
}

export async function confirmMfa(token: string | null | undefined, code: string): Promise<"ok" | "bad" | "signed-out"> {
  const user = await userFromToken(token);
  if (!user) return "signed-out";
  if (!user.totp_secret || !verifyTotp(user.totp_secret, code)) return "bad";
  const sql = await getSql();
  await sql.query(`update app_users set mfa_enabled = true where id = $1`, [user.id]);
  return "ok";
}

export async function disableMfa(token: string | null | undefined, code: string): Promise<"ok" | "bad" | "signed-out"> {
  const user = await userFromToken(token);
  if (!user) return "signed-out";
  if (!user.totp_secret || !verifyTotp(user.totp_secret, code)) return "bad";
  const sql = await getSql();
  await sql.query(`update app_users set mfa_enabled = false, totp_secret = null where id = $1`, [user.id]);
  return "ok";
}

async function startSession(sql: Sql, userId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await sql.query(
    `insert into app_sessions (token, user_id, expires_at) values ($1, $2, now() + interval '14 days')`,
    [token, userId],
  );
  return token;
}
