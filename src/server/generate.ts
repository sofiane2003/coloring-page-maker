import { and, eq, gt, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { z } from "zod";
import { db } from "@/db";
import { dailyUsage } from "@/db/schema";
import {
  NEGATIVE_PROMPT,
  buildImagePrompt,
  dayOf,
  sizeOf,
  titleFromPrompt,
  type generateInput,
} from "@/server/options";
import { insertPage, type PageRecord } from "@/server/pages";

const MODEL = "@cf/bytedance/stable-diffusion-xl-lightning";
const DEFAULT_DAILY_LIMIT = 25;

/** The DAILY_GENERATION_LIMIT setting, or 25 when it is unset or not a number. */
export function dailyLimit(): number {
  const raw = String((env as { DAILY_GENERATION_LIMIT?: unknown }).DAILY_GENERATION_LIMIT ?? "").trim();
  const value = raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_DAILY_LIMIT;
}

export async function remainingToday(userId: string, now = Date.now()): Promise<number> {
  const [row] = await db
    .select({ count: dailyUsage.count })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.day, dayOf(now))));
  return Math.max(0, dailyLimit() - (row?.count ?? 0));
}

/** Takes one generation from today's allowance; false when none is left. One statement, so two tabs can't both take the last one. */
async function reserve(userId: string, day: string, limit: number): Promise<boolean> {
  if (limit <= 0) return false;
  const taken = await db
    .insert(dailyUsage)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [dailyUsage.userId, dailyUsage.day],
      set: { count: sql`${dailyUsage.count} + 1` },
      setWhere: sql`${dailyUsage.count} < ${limit}`,
    })
    .returning({ count: dailyUsage.count });
  return taken.length > 0;
}

async function refund(userId: string, day: string): Promise<void> {
  await db
    .update(dailyUsage)
    .set({ count: sql`${dailyUsage.count} - 1` })
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.day, day), gt(dailyUsage.count, 0)));
}

async function bytesOf(output: unknown): Promise<Uint8Array> {
  if (output instanceof ReadableStream) return new Uint8Array(await new Response(output).arrayBuffer());
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  const image = (output as { image?: unknown } | null)?.image;
  if (typeof image === "string") return Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
  throw new Error("The model returned no image");
}

function imageType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { contentType: "image/png", extension: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { contentType: "image/jpeg", extension: "jpg" };
  return null;
}

export type GenerateResult =
  | { ok: true; page: PageRecord; remaining: number }
  | { ok: false; reason: "limit" | "failed"; remaining: number };

/**
 * Draws a page, stores the image, then the record. Anything that fails
 * leaves neither behind and gives the allowance back.
 */
export async function generatePage(
  userId: string,
  input: z.infer<typeof generateInput>,
): Promise<GenerateResult> {
  const now = Date.now();
  const day = dayOf(now);
  if (!(await reserve(userId, day, dailyLimit())))
    return { ok: false, reason: "limit", remaining: 0 };

  const id = crypto.randomUUID();
  let imageKey: string | null = null;
  try {
    const output = await env.AI.run(MODEL as never, {
      prompt: buildImagePrompt(input.prompt, input.ageLevel),
      negative_prompt: NEGATIVE_PROMPT,
      ...sizeOf(input.shape),
    } as never);
    const bytes = await bytesOf(output);
    const type = imageType(bytes);
    if (!type) throw new Error("The model returned an unknown image type");
    imageKey = `pages/${userId}/${id}.${type.extension}`;
    await env.files.put(imageKey, bytes, { httpMetadata: { contentType: type.contentType } });
    const page = await insertPage({
      id,
      userId,
      title: titleFromPrompt(input.prompt),
      prompt: input.prompt,
      ageLevel: input.ageLevel,
      shape: input.shape,
      imageKey,
      createdAt: now,
    });
    return { ok: true, page, remaining: await remainingToday(userId, now) };
  } catch (error) {
    console.error("generation failed", error);
    if (imageKey) await env.files.delete(imageKey).catch(() => undefined);
    await refund(userId, day);
    return { ok: false, reason: "failed", remaining: await remainingToday(userId, now) };
  }
}
