// F001 generate, F002 history, F003 gallery: the main path of each, in the browser.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { isPng, rows, startApp } from "./support.mjs";

const runtime = await startApp();
try {
  // Server routes.
  const health = await runtime.fetch("/health", { role: "member" });
  expect(health.status).toBe(200);

  const context = await runtime.context("member");
  await context.addInitScript(() => {
    window.__printed = 0;
    window.print = () => { window.__printed += 1; };
  });
  const page = await context.newPage();
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("remaining")).toContainText("25");

  // F001: prompt with counter, random idea and clear.
  const prompt = page.getByTestId("prompt-input");
  await prompt.fill("A cozy cottage");
  await expect(page.getByTestId("prompt-count")).toHaveText("14/300");
  await page.getByTestId("clear-prompt").click();
  await expect(prompt).toHaveValue("");
  await expect(page.getByTestId("generate")).toBeDisabled();
  await page.getByTestId("random-idea").click();
  await expect(prompt).not.toHaveValue("");
  await expect(page.getByTestId("generate")).toBeEnabled();

  const text = "A cozy cottage with a big sun, a tree and flowers";
  await prompt.fill(text);
  await page.getByTestId("age-toddler").click();
  await expect(page.getByTestId("age-toddler")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("age-kids").click();
  await expect(page.getByTestId("age-kids")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("age-toddler")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("shape-landscape").click();
  await page.getByTestId("shape-portrait").click();
  await expect(page.getByTestId("shape-portrait")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("result-image")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.getByTestId("result-image").evaluate((img) => img.naturalWidth)).toBe(768);
  await expect(page.getByTestId("remaining")).toContainText("24");

  let saved = await rows(runtime, "select * from pages where user_id = ?", "member");
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ prompt: text, age_level: "kids", shape: "portrait" });
  const firstId = saved[0].id;
  const image = await runtime.fetch(`/files/${firstId}`, { role: "member" });
  expect(image.status).toBe(200);
  expect(isPng(await image.arrayBuffer())).toBe(true);

  // Download as a PNG file.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);

  // Regenerate: same settings, a new record.
  await page.getByTestId("regenerate").click();
  await expect(page.getByTestId("remaining")).toContainText("23", { timeout: 30_000 });
  saved = await rows(runtime, "select * from pages where user_id = ? order by created_at", "member");
  expect(saved).toHaveLength(2);
  expect(saved[1]).toMatchObject({ prompt: text, age_level: "kids", shape: "portrait" });
  expect(saved[1].id).not.toBe(firstId);
  const secondId = saved[1].id;
  await expect(page.getByTestId("result-image")).toHaveAttribute("src", new RegExp(secondId));

  // A failed generation stores nothing and shows an error.
  await prompt.fill("FAILME a castle in the clouds");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("generate-error")).toBeVisible({ timeout: 30_000 });
  expect(await rows(runtime, "select id from pages where user_id = ?", "member")).toHaveLength(2);
  await expect(page.getByTestId("remaining")).toContainText("23");

  // Print view fits the image and prints.
  await page.goto(`/print/${secondId}`);
  await expect(page.getByTestId("print-image")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBeGreaterThan(0);

  // F002: history, newest first.
  await page.goto("/history");
  const cards = page.getByTestId("page-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute("data-page-id", secondId);
  await expect(cards.first()).toContainText(text);
  await expect(cards.first()).toContainText("Kids");
  await expect(cards.first()).toContainText("Portrait");

  // Open, rename.
  await cards.first().getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/pages/${secondId}$`));
  await expect(page.getByTestId("page-image")).toBeVisible();
  await expect(page.getByTestId("page-prompt")).toHaveText(text);
  await page.getByTestId("rename").click();
  await page.getByTestId("title-input").fill("Sunny cottage");
  await page.getByTestId("save-title").click();
  await expect(page.getByTestId("page-title")).toHaveText("Sunny cottage");
  expect((await rows(runtime, "select title from pages where id = ?", secondId))[0].title).toBe("Sunny cottage");

  // Download and print from the page.
  const [download2] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
  expect(download2.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByTestId("print")).toHaveAttribute("href", `/print/${secondId}`);

  // Start a new generation with its settings.
  await page.getByTestId("reuse").click();
  await expect(page.getByTestId("prompt-input")).toHaveValue(text);
  await expect(page.getByTestId("age-kids")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("shape-portrait")).toHaveAttribute("aria-pressed", "true");

  // Delete the older one after confirmation: record and image gone.
  await page.goto(`/pages/${firstId}`);
  await page.getByTestId("delete").click();
  await page.getByTestId("confirm-delete").click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId("page-card")).toHaveCount(1);
  expect(await rows(runtime, "select id from pages where id = ?", firstId)).toHaveLength(0);
  expect((await runtime.fetch(`/files/${firstId}`, { role: "member" })).status).toBe(404);

  // F003: publish to the gallery with a title and theme.
  await page.goto(`/pages/${secondId}`);
  await page.getByTestId("publish").click();
  await page.getByTestId("gallery-title").fill("Sunny cottage by the oak");
  await page.getByTestId("gallery-theme").click();
  await page.getByRole("option", { name: "Nature" }).click();
  await page.getByTestId("save-gallery").click();
  await expect(page.getByTestId("gallery-badge")).toContainText("Nature");

  // The owner (an admin here) generates and shares one of their own.
  const ownerPage = await (await runtime.context("owner")).newPage();
  await ownerPage.goto("/");
  await ownerPage.getByTestId("prompt-input").fill("A friendly elephant splashing in a pond");
  await ownerPage.getByTestId("age-toddler").click();
  await ownerPage.getByTestId("shape-square").click();
  await ownerPage.getByTestId("generate").click();
  await expect(ownerPage.getByTestId("result-image")).toBeVisible({ timeout: 30_000 });
  const elephantId = (await rows(runtime, "select id from pages where user_id = ?", "owner"))[0].id;
  await ownerPage.goto(`/pages/${elephantId}`);
  await ownerPage.getByTestId("publish").click();
  await ownerPage.getByTestId("gallery-title").fill("Elephant splash");
  await ownerPage.getByTestId("gallery-theme").click();
  await ownerPage.getByRole("option", { name: "Animals" }).click();
  await ownerPage.getByTestId("save-gallery").click();
  await expect(ownerPage.getByTestId("gallery-badge")).toContainText("Animals");

  // Browse newest first, filter by theme, search.
  await page.goto("/gallery");
  const entries = page.getByTestId("gallery-card");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText("Elephant splash");
  await page.getByTestId("theme-filter").click();
  await page.getByRole("option", { name: "Nature" }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Sunny cottage by the oak");
  await page.getByTestId("theme-filter").click();
  await page.getByRole("option", { name: "All themes" }).click();
  await expect(entries).toHaveCount(2);
  await page.getByTestId("gallery-search").fill("splashing");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Elephant splash");

  // Open someone else's entry: prompt, image, download, print, reuse; no owner actions.
  await entries.first().getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/pages/${elephantId}$`));
  await expect(page.getByTestId("page-prompt")).toHaveText("A friendly elephant splashing in a pond");
  await expect(page.getByTestId("page-image")).toBeVisible();
  await expect(page.getByTestId("rename")).toHaveCount(0);
  await expect(page.getByTestId("delete")).toHaveCount(0);
  await expect(page.getByTestId("unpublish")).toHaveCount(0);
  const [download3] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
  expect(download3.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByTestId("print")).toHaveAttribute("href", `/print/${elephantId}`);
  await page.getByTestId("reuse").click();
  await expect(page.getByTestId("prompt-input")).toHaveValue("A friendly elephant splashing in a pond");
  await expect(page.getByTestId("age-toddler")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("shape-square")).toHaveAttribute("aria-pressed", "true");

  // The owner of an entry edits it and takes it down.
  await page.goto(`/pages/${secondId}`);
  await page.getByTestId("publish").click();
  await page.getByTestId("gallery-theme").click();
  await page.getByRole("option", { name: "Holidays" }).click();
  await page.getByTestId("save-gallery").click();
  await expect(page.getByTestId("gallery-badge")).toContainText("Holidays");
  await page.getByTestId("unpublish").click();
  await expect(page.getByTestId("gallery-badge")).toHaveCount(0);
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-card")).toHaveCount(1);
  await page.goto(`/pages/${secondId}`);
  await page.getByTestId("publish").click();
  await page.getByTestId("gallery-theme").click();
  await page.getByRole("option", { name: "Nature" }).click();
  await page.getByTestId("save-gallery").click();
  await expect(page.getByTestId("gallery-badge")).toContainText("Nature");

  // The journey ends on a fresh result.
  await page.goto("/");
  await page.getByTestId("prompt-input").fill("A cozy cottage with a big sun, an oak tree and daisies");
  await page.getByTestId("age-kids").click();
  await page.getByTestId("shape-landscape").click();
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("result-image")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.getByTestId("result-image").evaluate((img) => img.naturalWidth)).toBe(1024);
  await runtime.screenshot(page);

  // Paging through the gallery.
  const db = await runtime.database();
  const now = Date.now();
  await db.batch(Array.from({ length: 13 }, (_, i) => db
    .prepare("insert into pages (id, user_id, title, prompt, age_level, shape, image_key, theme, published_at, created_at) values (?, 'owner', ?, ?, 'older', 'square', ?, 'patterns', ?, ?)")
    .bind(`seed-${i}`, `Pattern ${i}`, `Mandala pattern ${i}`, `pages/owner/seed-${i}.png`, now - i * 1000, now - i * 1000)));
  await page.goto("/gallery");
  await page.getByTestId("theme-filter").click();
  await page.getByRole("option", { name: "Patterns" }).click();
  await expect(page.getByTestId("gallery-card")).toHaveCount(12);
  await expect(page.getByTestId("gallery-card").first()).toContainText("Pattern 0");
  await page.getByTestId("next-page").click();
  await expect(page.getByTestId("gallery-card")).toHaveCount(1);
  await expect(page.getByTestId("gallery-card").first()).toContainText("Pattern 12");
  await page.getByTestId("prev-page").click();
  await expect(page.getByTestId("gallery-card")).toHaveCount(12);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByTestId("generate")).toBeVisible();
  await expect(phone.getByRole("link", { name: "All apps" })).toBeVisible();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await phone.goto("/history");
  await expect(phone.getByTestId("page-card").first()).toBeVisible();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
