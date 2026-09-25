import { createFileRoute } from "@tanstack/react-router";
import { appendFileSync } from "node:fs";
import { openEmailAccount } from "@/lib/auth/file-accounts.server";
import { dbSource } from "@/lib/db";

function explain(message: string): string {
  if (/no account/i.test(message)) return "沒有這個戶口。請先開戶口。";
  if (/invalid email or password/i.test(message)) return "電郵或密碼不正確。";
  if (/short/i.test(message)) return "密碼至少 8 個字。";
  if (/mismatch/i.test(message)) return "兩次密碼不相同。";
  if (/invalid email/i.test(message)) return "請輸入電郵。";
  return message || "未能儲存戶口。";
}

function page(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>香港租租</title><body style="font-family:sans-serif;background:#f4efe6;color:#1c2430;padding:2rem;line-height:1.5">${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

async function openAccount(request: Request) {
  const url = new URL(request.url);
  const wantsPage = url.searchParams.get("page") === "1";
  try {
    let email = url.searchParams.get("email") ?? "";
    let password = url.searchParams.get("password") ?? "";
    let name = url.searchParams.get("name") ?? "";
    let mode = url.searchParams.get("mode") ?? "register";
    const confirm = url.searchParams.get("confirm") ?? "";
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
    if ((mode === "register" || mode === "reset") && confirm && confirm !== password) {
      const message = "mismatch";
      if (wantsPage) {
        return page(`<p>${explain(message)}</p><p><a href="/login?mode=${mode}">返回</a></p>`);
      }
      return Response.json({ ok: false, message }, { headers: { "cache-control": "no-store" } });
    }
    const result = await openEmailAccount({ email, password, name, mode });
    try {
      appendFileSync(
        "/tmp/account-open.log",
        `${new Date().toISOString()} ${dbSource} ${mode} ${email.trim().toLowerCase()} ${result.ok ? "ok" : result.message}\n`,
      );
    } catch {
      /* logging must not block sign-in */
    }
    if (!wantsPage) return Response.json(result, { headers: { "cache-control": "no-store" } });
    if (!result.ok) {
      const back = mode === "signin" ? "signin" : mode;
      return page(`<p>${explain(result.message)}</p><p><a href="/login?mode=${back}">返回</a></p>`);
    }
    const saved = {
      token: result.token,
      user: {
        id: result.user.id,
        displayName: result.user.name,
        primaryEmail: result.user.email,
        profileImageUrl: null,
        isDevFallback: false,
      },
    };
    const json = JSON.stringify(saved).replace(/</g, "\\u003c");
    return page(`<p>戶口已儲存，正在進入帳簿…</p><script>
const saved = ${json};
sessionStorage.setItem("grok-auth.bearer-token", saved.token);
sessionStorage.setItem("grok-auth.user", JSON.stringify(saved.user));
location.replace("/desk");
</script>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account request failed";
    if (wantsPage) return page(`<p>${explain(message)}</p><p><a href="/login?mode=register">返回</a></p>`, 500);
    return Response.json({ ok: false, message });
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
