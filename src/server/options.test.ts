import { describe, expect, it } from "vitest";
import {
  buildImagePrompt,
  dayOf,
  fileNameFor,
  generateInput,
  sizeOf,
  titleFromPrompt,
} from "./options";

describe("generator options", () => {
  it("accepts 1 to 300 characters and the fixed choices only", () => {
    const ok = { prompt: "A fox", ageLevel: "kids", shape: "square" };
    expect(generateInput.safeParse(ok).success).toBe(true);
    expect(generateInput.safeParse({ ...ok, prompt: "   " }).success).toBe(false);
    expect(generateInput.safeParse({ ...ok, prompt: "x".repeat(301) }).success).toBe(false);
    expect(generateInput.safeParse({ ...ok, ageLevel: "baby" }).success).toBe(false);
    expect(generateInput.safeParse({ ...ok, shape: "wide" }).success).toBe(false);
  });

  it("asks for outline art at the age's level of detail", () => {
    const toddler = buildImagePrompt("a duck", "toddler");
    expect(toddler).toContain("a duck");
    expect(toddler).toMatch(/black and white line art/);
    expect(toddler).toMatch(/very large, simple shapes/);
    expect(buildImagePrompt("a duck", "older")).toMatch(/fine intricate detail/);
  });

  it("sizes each shape to its ratio", () => {
    expect(sizeOf("portrait")).toEqual({ width: 768, height: 1024 });
    expect(sizeOf("square")).toEqual({ width: 1024, height: 1024 });
    expect(sizeOf("landscape")).toEqual({ width: 1024, height: 768 });
  });

  it("names titles and files", () => {
    expect(titleFromPrompt("A fox")).toBe("A fox");
    expect(titleFromPrompt("word ".repeat(30)).length).toBeLessThanOrEqual(61);
    expect(fileNameFor("Sunny cottage!", "png")).toBe("sunny-cottage.png");
    expect(fileNameFor("???", "png")).toBe("coloring-page.png");
    expect(dayOf(Date.UTC(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  });
});
