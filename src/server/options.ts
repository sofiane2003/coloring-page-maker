import { z } from "zod";

export const AGE_LEVELS = [
  { value: "toddler", label: "Toddler" },
  { value: "kids", label: "Kids" },
  { value: "older", label: "Older kids & adults" },
] as const;
export type AgeLevel = (typeof AGE_LEVELS)[number]["value"];

export const SHAPES = [
  { value: "portrait", label: "Portrait", ratio: "3:4", width: 768, height: 1024 },
  { value: "square", label: "Square", ratio: "1:1", width: 1024, height: 1024 },
  { value: "landscape", label: "Landscape", ratio: "4:3", width: 1024, height: 768 },
] as const;
export type Shape = (typeof SHAPES)[number]["value"];

export const THEMES = [
  { value: "animals", label: "Animals" },
  { value: "vehicles", label: "Vehicles" },
  { value: "fantasy", label: "Fantasy" },
  { value: "nature", label: "Nature" },
  { value: "holidays", label: "Holidays" },
  { value: "sports", label: "Sports" },
  { value: "characters", label: "Characters" },
  { value: "patterns", label: "Patterns" },
  { value: "other", label: "Other" },
] as const;
export type Theme = (typeof THEMES)[number]["value"];

export const PROMPT_MAX = 300;
export const TITLE_MAX = 100;

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((item) => item.value) as [T[number]["value"], ...T[number]["value"][]];

export const ageLevelSchema = z.enum(values(AGE_LEVELS));
export const shapeSchema = z.enum(values(SHAPES));
export const themeSchema = z.enum(values(THEMES));
export const promptSchema = z.string().trim().min(1).max(PROMPT_MAX);
export const titleSchema = z.string().trim().min(1).max(TITLE_MAX);

export const generateInput = z
  .object({ prompt: promptSchema, ageLevel: ageLevelSchema, shape: shapeSchema })
  .strict();

export function labelOf(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  return list.find((item) => item.value === value)?.label ?? "";
}

const DETAIL: Record<AgeLevel, string> = {
  toddler:
    "for toddlers: one subject made of a few very large, simple shapes, extra thick outlines, plain white background with nothing else",
  kids: "for children: moderate detail, thick clean outlines, a simple background",
  older:
    "for older kids and adults: fine intricate detail, thin precise outlines, a detailed background",
};

/** What the image model is asked for: black outline art on white, at the level of detail the age calls for. */
export function buildImagePrompt(prompt: string, ageLevel: AgeLevel): string {
  return `Coloring book page, black and white line art of ${prompt.trim()}, ${DETAIL[ageLevel]}. Pure black outlines on a pure white background, no color, no gray, no shading, no text.`;
}

export const NEGATIVE_PROMPT =
  "color, colored, gray fill, shading, gradient, photo, realistic, text, letters, watermark, signature, blurry";

export function sizeOf(shape: Shape): { width: number; height: number } {
  const found = SHAPES.find((item) => item.value === shape)!;
  return { width: found.width, height: found.height };
}

/** A page's default title: its prompt, cut at a word to fit. */
export function titleFromPrompt(prompt: string): string {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (text.length <= 60) return text;
  const cut = text.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A file name for a download: the title in lowercase words joined by dashes. */
export function fileNameFor(title: string, extension: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "coloring-page"}.${extension}`;
}

/** The UTC day a generation counts toward. */
export function dayOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export const IDEAS = [
  "A dragon reading a book under a tree",
  "A sea turtle swimming past a coral reef",
  "A fire truck parked beside a fire station",
  "A unicorn jumping over a rainbow",
  "A bear having a picnic in the woods",
  "An astronaut planting a flag on the moon",
  "A castle with towers and a drawbridge",
  "A cat curled up in a basket of yarn",
  "A pirate ship sailing through big waves",
  "A snowman wearing a scarf and a top hat",
  "A garden full of sunflowers and butterflies",
  "A soccer player kicking a ball into a goal",
  "A train crossing a bridge over a river",
  "A mermaid sitting on a rock by the sea",
  "A dinosaur family walking through a jungle",
  "A hot air balloon over rolling hills",
  "An owl perched on a branch under a full moon",
  "A robot baking cookies in a kitchen",
  "A pumpkin patch with a scarecrow",
  "A mandala made of leaves and flowers",
];
