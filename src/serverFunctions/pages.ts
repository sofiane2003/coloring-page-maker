import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as generation from "@/server/generate";
import { generateInput } from "@/server/options";
import * as pages from "@/server/pages";

// Each server function runs behind ensureUserMiddleware: `context.user` is
// the member the Gateway signed in, and every query takes their id.

function found<T>(value: T | null): T {
  if (value === null) throw new Error("Page not found");
  return value;
}

export const getAllowance = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await pages.ensureUser(user);
    return { remaining: await generation.remainingToday(user.id), limit: generation.dailyLimit() };
  });

export const generatePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => generateInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await pages.ensureUser(user);
    return generation.generatePage(user.id, data);
  });

export const listMyPages = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context: { user } }) => pages.listMyPages(user.id));

/** A page the member may see, with what they may do to it; null otherwise. */
export const getPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => pages.idInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const page = await pages.getVisiblePage(user.id, data.id);
    if (!page) return null;
    const isOwner = page.userId === user.id;
    return {
      page,
      isOwner,
      canRemoveFromGallery: !isOwner && page.publishedAt !== null && isAdmin(user),
    };
  });

export const renamePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => pages.renameInput.parse(data))
  .handler(async ({ data, context: { user } }) => found(await pages.renamePage(user.id, data)));

export const deletePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => pages.idInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const imageKey = found(await pages.deletePage(user.id, data.id));
    await env.files.delete(imageKey);
    return { id: data.id };
  });

export const publishPage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => pages.publishInput.parse(data))
  .handler(async ({ data, context: { user } }) => found(await pages.publishPage(user.id, data)));

export const unpublishPage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => pages.idInput.parse(data))
  .handler(async ({ data, context: { user } }) =>
    found(await pages.unpublishPage(user.id, isAdmin(user), data.id)),
  );

export const listGallery = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => pages.galleryInput.parse(data))
  .handler(({ data }) => pages.listGallery(data));
