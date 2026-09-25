import { createFileRoute } from "@tanstack/react-router";
import { openEmailAccount } from "@/lib/auth/file-accounts.server";

async function openAccount(request: Request) {
  try {
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
    const result = openEmailAccount({ email, password, name, mode });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account request failed";
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
