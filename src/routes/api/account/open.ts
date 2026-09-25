import { createFileRoute } from "@tanstack/react-router";
import { appendFileSync } from "node:fs";
import { findAccountUser, openEmailAccount } from "@/lib/auth/file-accounts.server";
import { dbSource } from "@/lib/db";

function fail(mode: string, email: string, message: string, asPage: boolean) {
  if (!asPage) return jsonResult({ ok: false, message });
  const back = mode === "register" ? "register" : mode === "reset" ? "reset" : "signin";
  const error = /no account/i.test(message)
    ? "missing"
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

function sessionCookie(token: string | null): string {
  if (!token) return "er_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
  return `er_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`;
}

function jsonResult(body: unknown, cookie?: string | null, status = 200) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (cookie !== undefined) headers.append("set-cookie", sessionCookie(cookie));
  return Response.json(body, { status, headers });
}

function page(body: string, status = 200, cookie?: string | null) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  if (cookie !== undefined) headers.append("set-cookie", sessionCookie(cookie));
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

export async function openAccount(request: Request) {
  const url = new URL(request.url);
  const wantsPage = url.searchParams.get("page") === "1";
  try {
    let email = url.searchParams.get("email") ?? "";
    let password = url.searchParams.get("password") ?? "";
    let name = url.searchParams.get("name") ?? "";
    let mode = url.searchParams.get("mode") ?? "register";
    const confirm = url.searchParams.get("confirm") ?? "";
    if (mode === "signout") {
      return jsonResult({ ok: true }, null);
    }
    if (mode === "me") {
      const user = await findAccountUser(cookieValue(request.headers.get("cookie"), "er_session"));
      return jsonResult(user ? { ok: true, user: { id: user.id, name: user.email.split("@")[0], email: user.email } } : { ok: false });
    }
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
    password = password.trim();
    if ((mode === "register" || mode === "reset") && confirm && confirm !== password) {
      return fail(mode, email, "mismatch", wantsPage || request.method === "GET");
    }
    const signed = await openEmailAccount({ email, password, name, mode });
    try {
      appendFileSync(
        "/tmp/account-open.log",
        `${new Date().toISOString()} ${dbSource} ${mode} ${email.trim().toLowerCase()} len=${password.length} ${signed.ok ? "ok" : signed.message}\n`,
      );
    } catch {
      /* logging must not block sign-in */
    }
    if ((wantsPage || request.method === "GET") && signed.ok && mode !== "signout" && mode !== "me") {
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
      const headers = new Headers({
        location: `/desk#auth=${encodeURIComponent(JSON.stringify(saved))}`,
        "cache-control": "no-store",
      });
      headers.append("set-cookie", sessionCookie(signed.token));
      return new Response(null, { status: 302, headers });
    }
    if (!wantsPage && request.method !== "GET") return jsonResult(signed, signed.ok ? signed.token : undefined);
    if (!signed.ok) return fail(mode, email, signed.message, true);
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
localStorage.setItem("grok-auth.bearer-token", saved.token);
localStorage.setItem("grok-auth.user", JSON.stringify(saved.user));
location.replace("/desk");
</script><p><a href="/desk">進入帳簿</a></p>`, 200, signed.token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account request failed";
    return fail("signin", "", message, true);
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
