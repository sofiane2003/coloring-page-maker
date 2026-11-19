import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { fileNameFor } from "@/server/options";
import { getVisibleImage } from "@/server/pages";

// A page's image: to its owner, or to any member once it is in the gallery.
// `?download=1` asks the browser to save it.
export const Route = createFileRoute("/files/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const page = await getVisibleImage(user.id, params.id);
        const object = page ? await env.files.get(page.imageKey) : null;
        if (!page || !object) return new Response("Not found", { status: 404 });
        const headers = new Headers({
          "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "private, max-age=3600",
          "x-content-type-options": "nosniff",
        });
        if (new URL(request.url).searchParams.has("download")) {
          const extension = page.imageKey.split(".").pop() ?? "png";
          headers.set(
            "content-disposition",
            `attachment; filename="${fileNameFor(page.title, extension)}"`,
          );
        }
        return new Response(object.body, { headers });
      },
    },
  },
});
