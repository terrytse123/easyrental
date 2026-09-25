import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type UserRow = { id: string; name: string; email: string; password: string };
type SessionRow = { token: string; userId: string; expiresAt: number };
type Store = { users: UserRow[]; sessions: SessionRow[] };

const globalStore = globalThis as typeof globalThis & { __emailAccounts?: Store };

function storePath(): string {
  const dir = process.env.VERCEL ? "/tmp" : join(process.cwd(), ".data");
  return join(dir, "email-accounts.json");
}

function empty(): Store {
  return { users: [], sessions: [] };
}

function load(): Store {
  if (!globalStore.__emailAccounts) {
    try {
      globalStore.__emailAccounts = JSON.parse(readFileSync(storePath(), "utf8")) as Store;
    } catch {
      globalStore.__emailAccounts = empty();
    }
  }
  return globalStore.__emailAccounts;
}

function save(store: Store): void {
  globalStore.__emailAccounts = store;
  try {
    const path = storePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store));
  } catch {
    /* keep the in-memory copy if the disk is read-only */
  }
}

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

export function findAccountUser(token: string | null | undefined): { id: string; email: string } | null {
  if (!token) return null;
  const store = load();
  const now = Date.now();
  const session = store.sessions.find((row) => row.token === token && row.expiresAt > now);
  if (!session) return null;
  const user = store.users.find((row) => row.id === session.userId);
  return user ? { id: user.id, email: user.email } : null;
}

export function openEmailAccount(input: {
  email: string;
  password: string;
  name: string;
  mode: string;
}): { ok: true; token: string; user: { id: string; name: string; email: string } } | { ok: false; message: string } {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name.trim();
  if (!email.includes("@") || email.length > 120) return { ok: false, message: "Invalid email" };
  if (password.length < 8 || password.length > 200) return { ok: false, message: "Password too short" };

  const store = load();
  const existing = store.users.find((row) => row.email === email);
  if (input.mode === "signin") {
    if (!existing || !checkPassword(password, existing.password)) {
      return { ok: false, message: "Invalid email or password" };
    }
    const token = startSession(store, existing.id);
    save(store);
    return { ok: true, token, user: { id: existing.id, name: existing.name, email: existing.email } };
  }
  if (existing) return { ok: false, message: "User already exists. Use another email." };

  const user: UserRow = {
    id: randomBytes(16).toString("hex"),
    name: name || email.split("@")[0] || email,
    email,
    password: hashPassword(password),
  };
  store.users.push(user);
  const token = startSession(store, user.id);
  save(store);
  return { ok: true, token, user: { id: user.id, name: user.name, email: user.email } };
}

function startSession(store: Store, userId: string): string {
  const token = randomBytes(24).toString("hex");
  store.sessions.push({ token, userId, expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 });
  return token;
}

export function accountsFileExists(): boolean {
  return existsSync(storePath());
}
