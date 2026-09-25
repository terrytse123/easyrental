import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Account open/sign-in that does not depend on a browser POST to `/api/auth`.
 * The live preview delivers GET reliably and often drops that auth POST, which
 * made every email look like it could not be registered.
 */
async function openAccount(request: Request) {
  const url = new URL(request.url);
  let email = url.searchParams.get("email") ?? "";
  let password = url.searchParams.get("password") ?? "";
  let name = url.searchParams.get("name") ?? "";
  let mode = url.searchParams.get("mode") ?? "register";
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { email?: string; password?: string; name?: string; mode?: string };
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
    return Response.json({ ok: false, message: "Invalid email" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return Response.json({ ok: false, message: "Password too short" }, { status: 400 });
  }

  const path = mode === "signin" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email";
  const inner = new Request(`http://127.0.0.1:8080${path}`, {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:8080",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password, name: name || email }),
  });
  const response = await auth.handler(inner);
  const text = await response.text();
  let payload: { token?: string; message?: string; code?: string } = {};
  try {
    payload = JSON.parse(text) as { token?: string; message?: string; code?: string };
  } catch {
    payload = {};
  }
  if (!response.ok) {
    return Response.json(
      { ok: false, message: payload.message || payload.code || `HTTP ${response.status}` },
      { status: 200 },
    );
  }
  const token = response.headers.get("set-auth-token") || payload.token || null;
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  if (token) headers.set("set-auth-token", token);
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ ok: true, token }), { status: 200, headers });
}

export const Route = createFileRoute("/api/account/open")({
  server: {
    handlers: {
      GET: ({ request }) => openAccount(request),
      POST: ({ request }) => openAccount(request),
    },
  },
});
