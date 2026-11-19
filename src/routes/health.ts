import { createFileRoute } from "@tanstack/react-router";

// For an uptime monitor, which reaches it with a personal access token.
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true }),
    },
  },
});
