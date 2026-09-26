import { createFileRoute } from "@tanstack/react-router";
import { appendFileSync } from "node:fs";
import {
  cookieShouldBeSecure,
  rejectGetWithSecretParams,
  sessionCookieHeader,
} from "@/lib/auth/account-open-guards";
import { findAccountUser, openEmailAccount, beginMfa, confirmMfa, disableMfa, securityView, updateProfile, changePassword } from "@/lib/auth/file-accounts.server";
import { dbSource } from "@/lib/db";

function fail(mode: string, email: string, message: string, asPage: boolean, request: Request) {
  if (!asPage) return jsonResult({ ok: false, message }, request);
  const back =
    mode === "register"
      ? "register"
      : mode === "reset-code"
        ? "reset-code"
        : mode === "reset"
          ? "reset"
          : "signin";
  const error = /no account/i.test(message)
    ? "missing"
    : /bad code/i.test(message)
      ? "code"
      : /mail failed/i.test(message)
        ? "mail"
        : /invalid email or password/i.test(message)
          ? "bad"
          : /already/i.test(message)
            ? "exists"
            : /mismatch/i.test(message)
              ? "mismatch"
              : /short/i.test(message)
                ? "short"
                : /invalid email/i.test(message)
                  ? "email"
                  : "fail";
  const query = new URLSearchParams({ mode: back, error });
  if (email.trim()) query.set("email", email.trim().toLowerCase());
  return new Response(null, {
    status: 302,
    headers: { location: `/login?${query.toString()}`, "cache-control": "no-store" },
  });
}

function sessionCookie(token: string | null, request: Request): string {
  const secure = cookieShouldBeSecure({
    nodeEnv: process.env.NODE_ENV,
    requestUrl: request.url,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  return sessionCookieHeader(token, secure);
}

function jsonResult(body: unknown, request: Request, cookie?: string | null, status = 200) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (cookie !== undefined) headers.append("set-cookie", sessionCookie(cookie, request));
  return Response.json(body, { status, headers });
}

function page(body: string, request: Request, status = 200, cookie?: string | null) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  if (cookie !== undefined) headers.append("set-cookie", sessionCookie(cookie, request));
  return new Response(
    `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>香港租租</title><body style="font-family:sans-serif;background:#f4efe6;color:#1c2430;padding:2rem;line-height:1.5">${body}</body></html>`,
    { status, headers },
  );
}

function cookieValue(header: string | null, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

async function readBodyFields(request: Request): Promise<Record<string, string>> {
  if (request.method !== "POST") return {};
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") out[key] = value;
        else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
      }
      return out;
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      const out: Record<string, string> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") out[key] = value;
      }
      return out;
    }
  } catch {
    /* fall through to query string */
  }
  return {};
}

export async function openAccount(request: Request) {
  const url = new URL(request.url);
  if (rejectGetWithSecretParams(request.method, url.searchParams)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    });
  }

  const body = await readBodyFields(request);
  const pick = (name: string) => body[name] ?? url.searchParams.get(name) ?? "";

  const wantsPage = pick("page") === "1";
  try {
    let email = pick("email");
    let password = pick("password");
    let name = pick("name");
    let mode = pick("mode") || "register";
    const confirm = pick("confirm");
    const nextPassword = pick("next").trim();
    const code = pick("code");
    const challenge = pick("challenge");
    const session = cookieValue(request.headers.get("cookie"), "er_session");

    if (mode === "signout") {
      return jsonResult({ ok: true }, request, null);
    }
    if (mode === "security") {
      const view = await securityView(session);
      return jsonResult(view ? { ok: true, ...view } : { ok: false }, request);
    }
    if (mode === "mfa-start" || mode === "mfa-confirm" || mode === "mfa-off") {
      if (mode === "mfa-start") await beginMfa(session);
      const result = mode === "mfa-confirm" ? await confirmMfa(session, code) : mode === "mfa-off" ? await disableMfa(session, code) : "ok";
      if (result === "signed-out") {
        return new Response(null, { status: 302, headers: { location: "/login", "cache-control": "no-store" } });
      }
      const query = result === "bad" ? "?error=code" : result === "ok" && mode !== "mfa-start" ? "?ok=1" : "";
      return new Response(null, { status: 302, headers: { location: `/security${query}`, "cache-control": "no-store" } });
    }
    if (mode === "profile" || mode === "password") {
      const result = mode === "profile"
        ? await updateProfile(session, name)
        : await changePassword(session, password, nextPassword, confirm.trim(), code);
      if (result === "signed-out") {
        return new Response(null, { status: 302, headers: { location: "/login", "cache-control": "no-store" } });
      }
      const error = result === "ok" ? "" : result === "bad" ? (mode === "profile" ? "name" : "bad") : result;
      const query = result === "ok" ? `?ok=${mode}` : `?error=${error}`;
      return new Response(null, { status: 302, headers: { location: `/security${query}`, "cache-control": "no-store" } });
    }
    if (mode === "me") {
      const user = await findAccountUser(cookieValue(request.headers.get("cookie"), "er_session"));
      return jsonResult(user ? { ok: true, user: { id: user.id, name: user.email.split("@")[0], email: user.email } } : { ok: false }, request);
    }

    password = password.trim();
    if ((mode === "register" || mode === "reset-code") && confirm && confirm !== password) {
      return fail(mode, email, "mismatch", wantsPage || request.method === "GET", request);
    }
    const signed = await openEmailAccount({ email, password, name, mode, code, challenge });
    try {
      appendFileSync(
        "/tmp/account-open.log",
        `${new Date().toISOString()} ${dbSource} ${mode} ${email.trim().toLowerCase()} len=${password.length} ${signed.ok ? "ok" : signed.message}\n`,
      );
    } catch {
      /* logging must not block sign-in */
    }
    if (!signed.ok && signed.next && (wantsPage || request.method === "GET")) {
      const query = new URLSearchParams({ mode: signed.next });
      if (email.trim()) query.set("email", email.trim().toLowerCase());
      if (signed.challenge) query.set("challenge", signed.challenge);
      if (/mail failed/i.test(signed.message)) query.set("error", "mail");
      if (/bad code/i.test(signed.message)) query.set("error", "code");
      return new Response(null, {
        status: 302,
        headers: { location: `/login?${query.toString()}`, "cache-control": "no-store" },
      });
    }
    // Prefer HttpOnly cookie as source of truth; desk resolves via mode=me.
    // Avoid putting the bearer token in the URL hash (token bleed).
    if ((wantsPage || request.method === "GET") && signed.ok && mode !== "signout" && mode !== "me") {
      const headers = new Headers({
        location: "/desk",
        "cache-control": "no-store",
      });
      headers.append("set-cookie", sessionCookie(signed.token, request));
      return new Response(null, { status: 302, headers });
    }
    if (!wantsPage && request.method !== "GET") {
      if (!signed.ok && signed.next) {
        return jsonResult(signed, request);
      }
      return jsonResult(signed, request, signed.ok ? signed.token : undefined);
    }
    if (!signed.ok) return fail(mode, email, signed.message, true, request);
    // Legacy HTML bridge: sessionStorage only (HttpOnly cookie already set).
    const saved = {
      token: signed.token,
      user: {
        id: signed.user.id,
        displayName: signed.user.name,
        primaryEmail: signed.user.email,
        profileImageUrl: null,
        isDevFallback: false,
      },
    };
    const json = JSON.stringify(saved).replace(/</g, "\\u003c");
    return page(`<p>正在進入帳簿…</p><script>
const saved = ${json};
sessionStorage.setItem("grok-auth.bearer-token", saved.token);
sessionStorage.setItem("grok-auth.user", JSON.stringify(saved.user));
location.replace("/desk");
</script><p><a href="/desk">進入帳簿</a></p>`, request, 200, signed.token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account request failed";
    try {
      appendFileSync("/tmp/account-open.log", `${new Date().toISOString()} throw ${message}\n`);
    } catch {
      /* ignore */
    }
    return fail("signin", "", message, true, request);
  }
}

export const Route = createFileRoute("/api/account/open")({
  server: {
    handlers: {
      GET: ({ request }) => openAccount(request),
      POST: ({ request }) => openAccount(request),
    },
  },
});
