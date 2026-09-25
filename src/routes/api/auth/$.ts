import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * The live preview is often opened on grok.com (or a *.preview host), while
 * Better Auth only trusts *.grok-sandbox.com and localhost. A same-app POST
 * then fails with "Invalid origin". When the browser origin is one of those
 * known shells, present a trusted loopback origin. Cross-site pages are left
 * unchanged so they still fail the check.
 */
function previewShellOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com")) return false;
    if (host === "grok.com" || host.endsWith(".grok.com")) return true;
    if (host === "x.ai" || host.endsWith(".x.ai")) return true;
    if (host.includes(".preview.")) return true;
    return false;
  } catch {
    return false;
  }
}

async function acceptPreviewShell(request: Request): Promise<Request> {
  const origin = request.headers.get("origin");
  if (!origin || !previewShellOrigin(origin)) return request;
  const headers = new Headers(request.headers);
  headers.set("origin", "http://127.0.0.1:8080");
  const body = await request.arrayBuffer();
  return new Request(request.url, {
    method: request.method,
    headers,
    body: body.byteLength ? body : undefined,
  });
}

function hostOf(value: string | null): string {
  return (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
}

function originOf(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Trust this browser's own page, whatever host the preview is using. */
function trustThisRequest(request: Request): string | null {
  const origin = originOf(request.headers.get("origin")) ?? originOf(request.headers.get("referer"));
  if (!origin) return null;
  const originHost = new URL(origin).host.toLowerCase();
  const forwarded = hostOf(request.headers.get("x-forwarded-host"));
  const host = hostOf(request.headers.get("host"));
  const site = request.headers.get("sec-fetch-site");
  const samePage =
    (forwarded !== "" && originHost === forwarded) ||
    (host !== "" && originHost === host) ||
    site === "same-origin" ||
    site === "none" ||
    previewShellOrigin(origin);
  return samePage ? origin : null;
}

function allowOrigin(origin: string) {
  const key = "BETTER_AUTH_TRUSTED_ORIGINS";
  const parts = (process.env[key] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.includes(origin)) return;
  parts.push(origin);
  process.env[key] = parts.join(",");
}

async function handle(request: Request) {
  const trusted = trustThisRequest(request);
  if (trusted) allowOrigin(trusted);
  return auth.handler(await acceptPreviewShell(request));
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
