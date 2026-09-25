import { createFileRoute } from "@tanstack/react-router";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";

type AccountUser = { id: string; name: string; email: string };

function id(): string {
  return randomBytes(16).toString("hex");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function checkPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

async function openAccount(request: Request) {
  try {
    const url = new URL(request.url);
    let email = url.searchParams.get("email") ?? "";
    let password = url.searchParams.get("password") ?? "";
    let name = url.searchParams.get("name") ?? "";
    let mode = url.searchParams.get("mode") ?? "register";
    if (request.method === "POST") {
      try {
        const body = (await request.json()) as {
          email?: string;
          password?: string;
          name?: string;
          mode?: string;
        };
        email = body.email ?? email;
        password = body.password ?? password;
        name = body.name ?? name;
        mode = body.mode ?? mode;
      } catch {
        /* query string is enough */
      }
    }
    email = email.trim().toLowerCase();
    name = name.trim();
    if (!email.includes("@") || email.length > 120) {
      return Response.json({ ok: false, message: "Invalid email" });
    }
    if (password.length < 8 || password.length > 200) {
      return Response.json({ ok: false, message: "Password too short" });
    }

    const sql = await getSql();
    const existing = await sql.query<{
      id: string;
      name: string;
      email: string;
      password: string | null;
    }>(
      `select u."id", u."name", u."email", a."password"
       from "user" u
       left join "account" a on a."userId" = u."id" and a."providerId" = 'credential'
       where lower(u."email") = $1
       limit 1`,
      [email],
    );
    const found = existing[0];

    if (mode === "signin") {
      if (!found || !checkPassword(password, found.password)) {
        return Response.json({ ok: false, message: "Invalid email or password" });
      }
      const token = await createSession(sql, found.id);
      return Response.json({
        ok: true,
        token,
        user: { id: found.id, name: found.name, email: found.email },
      });
    }

    if (found) {
      return Response.json({ ok: false, message: "User already exists. Use another email." });
    }

    const userId = id();
    const display = name || email.split("@")[0] || email;
    await sql.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       values ($1, $2, $3, false, now(), now())`,
      [userId, display, email],
    );
    await sql.query(
      `insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       values ($1, $2, 'credential', $3, $4, now(), now())`,
      [id(), userId, userId, hashPassword(password)],
    );
    const token = await createSession(sql, userId);
    const user: AccountUser = { id: userId, name: display, email };
    return Response.json({ ok: true, token, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account request failed";
    return Response.json({ ok: false, message });
  }
}

async function createSession(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await sql.query(
    `insert into "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
     values ($1, now() + interval '14 days', $2, now(), now(), $3)`,
    [id(), token, userId],
  );
  return token;
}

export const Route = createFileRoute("/api/account/open")({
  server: {
    handlers: {
      GET: ({ request }) => openAccount(request),
      POST: ({ request }) => openAccount(request),
    },
  },
});
