import { createFileRoute } from "@tanstack/react-router";
import { mailAllDueRenewals } from "@/lib/rental/renewal-mail.server";

function allowed(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!allowed(request)) return new Response("unauthorized", { status: 401 });
  const result = await mailAllDueRenewals();
  return Response.json(result);
}

export const Route = createFileRoute("/api/renewal")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
