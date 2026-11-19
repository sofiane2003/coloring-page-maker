import { and, desc, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, users } from "@/db/schema";
import { themeSchema, titleSchema } from "@/server/options";

export const idInput = z.object({ id: z.string().min(1).max(64) }).strict();
export const renameInput = z.object({ id: z.string().min(1).max(64), title: titleSchema }).strict();
export const publishInput = z
  .object({ id: z.string().min(1).max(64), title: titleSchema, theme: themeSchema })
  .strict();
export const galleryInput = z
  .object({
    theme: themeSchema.optional(),
    q: z.string().trim().max(100).optional(),
    page: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const GALLERY_PAGE_SIZE = 12;

const shown = {
  id: pages.id,
  userId: pages.userId,
  title: pages.title,
  prompt: pages.prompt,
  ageLevel: pages.ageLevel,
  shape: pages.shape,
  theme: pages.theme,
  publishedAt: pages.publishedAt,
  createdAt: pages.createdAt,
};

export interface PageRecord {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  ageLevel: string;
  shape: string;
  theme: string | null;
  publishedAt: number | null;
  createdAt: number;
}

/** Records the member the first time they are seen. */
export async function ensureUser(user: { id: string; email: string }): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email, createdAt: Date.now() })
    .onConflictDoNothing();
}

/** A page this user may see: their own, or one in the gallery. */
function visibleTo(userId: string): SQL {
  return or(eq(pages.userId, userId), isNotNull(pages.publishedAt))!;
}

export function listMyPages(userId: string): Promise<PageRecord[]> {
  return db
    .select(shown)
    .from(pages)
    .where(eq(pages.userId, userId))
    .orderBy(desc(pages.createdAt), desc(pages.id));
}

export async function getVisiblePage(userId: string, id: string): Promise<PageRecord | null> {
  const [page] = await db
    .select(shown)
    .from(pages)
    .where(and(eq(pages.id, id), visibleTo(userId)));
  return page ?? null;
}

/** The stored image's key, when this user may see the page. */
export async function getVisibleImage(
  userId: string,
  id: string,
): Promise<{ imageKey: string; title: string } | null> {
  const [page] = await db
    .select({ imageKey: pages.imageKey, title: pages.title })
    .from(pages)
    .where(and(eq(pages.id, id), visibleTo(userId)));
  return page ?? null;
}

export async function insertPage(row: typeof pages.$inferInsert): Promise<PageRecord> {
  const [page] = await db.insert(pages).values(row).returning(shown);
  return page!;
}

/** Null when no page of this user has the id. */
export async function renamePage(
  userId: string,
  { id, title }: z.infer<typeof renameInput>,
): Promise<PageRecord | null> {
  const [page] = await db
    .update(pages)
    .set({ title })
    .where(and(eq(pages.id, id), eq(pages.userId, userId)))
    .returning(shown);
  return page ?? null;
}

/** Removes the record; the caller removes the image at the returned key. */
export async function deletePage(userId: string, id: string): Promise<string | null> {
  const [page] = await db
    .delete(pages)
    .where(and(eq(pages.id, id), eq(pages.userId, userId)))
    .returning({ imageKey: pages.imageKey });
  return page?.imageKey ?? null;
}

/** Shares the page, or changes its gallery title and theme. Owner only. */
export async function publishPage(
  userId: string,
  { id, title, theme }: z.infer<typeof publishInput>,
): Promise<PageRecord | null> {
  const [page] = await db
    .update(pages)
    .set({ title, theme, publishedAt: sql`coalesce(${pages.publishedAt}, ${Date.now()})` })
    .where(and(eq(pages.id, id), eq(pages.userId, userId)))
    .returning(shown);
  return page ?? null;
}

/** Takes a page out of the gallery: the owner's own, or any one for an admin. */
export async function unpublishPage(
  userId: string,
  admin: boolean,
  id: string,
): Promise<PageRecord | null> {
  const [page] = await db
    .update(pages)
    .set({ publishedAt: null, theme: null })
    .where(
      and(
        eq(pages.id, id),
        isNotNull(pages.publishedAt),
        admin ? undefined : eq(pages.userId, userId),
      ),
    )
    .returning(shown);
  return page ?? null;
}

export async function listGallery({
  theme,
  q,
  page,
}: z.infer<typeof galleryInput>): Promise<{ items: PageRecord[]; hasMore: boolean }> {
  const conditions: SQL[] = [isNotNull(pages.publishedAt)];
  if (theme) conditions.push(eq(pages.theme, theme));
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        sql`${pages.title} like ${pattern} escape '\\'`,
        sql`${pages.prompt} like ${pattern} escape '\\'`,
      )!,
    );
  }
  const found = await db
    .select(shown)
    .from(pages)
    .where(and(...conditions))
    .orderBy(desc(pages.publishedAt), desc(pages.id))
    .limit(GALLERY_PAGE_SIZE + 1)
    .offset((page - 1) * GALLERY_PAGE_SIZE);
  return { items: found.slice(0, GALLERY_PAGE_SIZE), hasMore: found.length > GALLERY_PAGE_SIZE };
}
