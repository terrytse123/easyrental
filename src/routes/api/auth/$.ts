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

async function handle(request: Request) {
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
