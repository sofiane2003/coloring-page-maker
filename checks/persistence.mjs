// Pages, images, gallery entries and the daily allowance survive a restart.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { isPng, rows, startApp } from "./support.mjs";

const runtime = await startApp({ bindings: { DAILY_GENERATION_LIMIT: { type: "text", value: "2" } } });
try {
  const page = await (await runtime.context("member")).newPage();
  await page.goto("/history");
  await expect(page.getByTestId("history-empty")).toBeVisible();
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-empty")).toBeVisible();

  await page.goto("/");
  await expect(page.getByTestId("remaining")).toContainText("2");
  await page.getByTestId("prompt-input").fill("A lighthouse on a rocky shore");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("remaining")).toContainText("1", { timeout: 30_000 });
  await page.getByTestId("regenerate").click();
  await expect(page.getByTestId("remaining")).toContainText("0", { timeout: 30_000 });
  await expect(page.getByTestId("limit-reached")).toBeVisible();
  await expect(page.getByTestId("generate")).toBeDisabled();
  await expect(page.getByTestId("regenerate")).toBeDisabled();
  expect(await rows(runtime, "select id from pages where user_id = 'member'")).toHaveLength(2);

  const [id] = (await rows(runtime, "select id from pages where user_id = 'member' order by created_at")).map((r) => r.id);
  await page.goto(`/pages/${id}`);
  await page.getByTestId("rename").click();
  await page.getByTestId("title-input").fill("Lighthouse at dusk");
  await page.getByTestId("save-title").click();
  await expect(page.getByTestId("page-title")).toHaveText("Lighthouse at dusk");
  await page.getByTestId("publish").click();
  await page.getByTestId("gallery-theme").click();
  await page.getByRole("option", { name: "Nature" }).click();
  await page.getByTestId("save-gallery").click();
  await expect(page.getByTestId("gallery-badge")).toContainText("Nature");

  await runtime.restart();

  await page.goto("/history");
  await expect(page.getByTestId("page-card")).toHaveCount(2);
  await page.goto(`/pages/${id}`);
  await expect(page.getByTestId("page-title")).toHaveText("Lighthouse at dusk");
  await expect(page.getByTestId("gallery-badge")).toContainText("Nature");
  const image = await runtime.fetch(`/files/${id}`, { role: "owner" });
  expect(image.status).toBe(200);
  expect(isPng(await image.arrayBuffer())).toBe(true);
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-card")).toHaveCount(1);
  await expect(page.getByTestId("gallery-card").first()).toContainText("Lighthouse at dusk");

  // The allowance is still used up after the restart.
  await page.goto("/");
  await expect(page.getByTestId("remaining")).toContainText("0");
  await expect(page.getByTestId("limit-reached")).toBeVisible();
  await expect(page.getByTestId("generate")).toBeDisabled();
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
