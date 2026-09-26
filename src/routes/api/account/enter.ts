import { createFileRoute } from "@tanstack/react-router";
import { openAccount } from "./open";

export const Route = createFileRoute("/api/account/enter")({
  server: {
    handlers: {
      GET: ({ request }) => openAccount(request),
      POST: ({ request }) => openAccount(request),
    },
  },
});
