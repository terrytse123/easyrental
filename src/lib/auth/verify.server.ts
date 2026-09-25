import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "../db";
import { gateIdentityEnabled } from "./gate-identity.server";
import { auth, authConfigured } from "./server";

const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

export { authConfigured };

if (databaseConfigured && !authConfigured) {
  console.error(
    "[auth] DATABASE_URL is set but auth is disabled (VITE_AUTH_ENABLED=false) " +
      "— requireUserId() will reject every request (fail closed) rather than " +
      "share one dev user on a real database.",
  );
}

export const DEV_USER_ID = "dev-user";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

function bearerFrom(headers: Headers, extra?: string): string | null {
  const raw = extra?.trim() || headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  return raw || null;
}

async function userFromToken(token: string): Promise<VerifiedUser | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; email: string | null }>(
      `select u."id", u."email"
       from "session" s
       join "user" u on u."id" = s."userId"
       where s."token" = $1 and s."expiresAt" > now()
       limit 1`,
      [token.split(".")[0]],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email } : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(bearerToken?: string): Promise<VerifiedUser | null> {
  if (!authConfigured && !gateIdentityEnabled()) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  try {
    const session = await auth.api.getSession({ headers });
    if (session?.user) return { id: session.user.id, email: session.user.email ?? null };
  } catch {
    /* fall through to the app session table */
  }
  const token = bearerFrom(headers, bearerToken);
  if (!token) return null;
  return userFromToken(token);
}

export async function requireUserId(bearerToken?: string): Promise<string> {
  if (!authConfigured && !gateIdentityEnabled()) {
    if (databaseConfigured) {
      throw new Error(
        "Auth is disabled (VITE_AUTH_ENABLED=false) but DATABASE_URL is set — " +
          "refusing to fall back to the shared dev user against a real database.",
      );
    }
    return DEV_USER_ID;
  }
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}
