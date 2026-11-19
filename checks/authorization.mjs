// X001 and the ownership rules of F001-F003.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { rows, startApp } from "./support.mjs";

const runtime = await startApp();
try {
  await runtime.assertPrivateAccess(["/", "/history", "/gallery", "/health"]);

  async function generate(page, text) {
    await page.goto("/");
    await page.getByTestId("prompt-input").fill(text);
    await page.getByTestId("generate").click();
    await expect(page.getByTestId("result-image")).toBeVisible({ timeout: 30_000 });
  }
  async function publish(page, id, title, theme) {
    await page.goto(`/pages/${id}`);
    await page.getByTestId("publish").click();
    await page.getByTestId("gallery-title").fill(title);
    await page.getByTestId("gallery-theme").click();
    await page.getByRole("option", { name: theme }).click();
    await page.getByTestId("save-gallery").click();
    await expect(page.getByTestId("gallery-badge")).toContainText(theme);
  }
  const idOf = async (user, prompt) => (await rows(runtime, "select id from pages where user_id = ? and prompt = ?", user, prompt))[0].id;
  /** Runs `action` and returns the server function call it made. */
  async function capture(page, action) {
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/_serverFn/") && r.method() === "POST"),
      action(),
    ]);
    return { path: new URL(request.url()).pathname + new URL(request.url()).search, headers: request.headers(), body: request.postData() ?? "" };
  }
  /** Sends a captured call again with `from` replaced by `to`; true when the server refused it. */
  async function replay(call, role, from, to) {
    const headers = Object.fromEntries(Object.entries(call.headers).filter(([k]) => !["cookie", "host", "content-length"].includes(k)));
    const body = call.body.replaceAll(from, to);
    expect(body).not.toBe(call.body);
    const response = await runtime.fetch(call.path, { role, method: "POST", headers, body });
    // A server function that throws answers with the error serialized in its result.
    return !response.ok || (await response.text()).includes("$TSR/Error");
  }

  const ownerPage = await (await runtime.context("owner")).newPage();
  const memberPage = await (await runtime.context("member")).newPage();

  // Owner: one private page, one shared page. Member: one page.
  await generate(ownerPage, "A secret garden behind a tall wall");
  await generate(ownerPage, "A rocket ship flying past the moon");
  await generate(memberPage, "A puppy wearing rain boots");
  const ownerPrivate = await idOf("owner", "A secret garden behind a tall wall");
  const ownerShared = await idOf("owner", "A rocket ship flying past the moon");
  const memberOwn = await idOf("member", "A puppy wearing rain boots");
  await publish(ownerPage, ownerShared, "Moon rocket", "Vehicles");
  expect((await rows(runtime, "select user_id from pages where user_id in ('owner', 'member')")).length).toBe(3);

  // Images: private ones only to their owner, shared ones to every member, never to strangers.
  expect((await runtime.fetch(`/files/${ownerPrivate}`, { role: "owner" })).status).toBe(200);
  expect((await runtime.fetch(`/files/${ownerPrivate}`, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(`/files/${ownerShared}`, { role: "member" })).status).toBe(200);
  for (const role of [undefined, "outsider"]) {
    expect([401, 403]).toContain((await runtime.fetch(`/files/${ownerShared}`, { role })).status);
    expect([401, 403]).toContain((await runtime.fetch(`/files/${memberOwn}`, { role })).status);
  }

  // History shows only one's own pages.
  await memberPage.goto("/history");
  await expect(memberPage.getByTestId("page-card")).toHaveCount(1);
  await expect(memberPage.getByTestId("page-card").first()).toContainText("A puppy wearing rain boots");

  // Another member's private page is not found, in the page and the print view.
  await memberPage.goto(`/pages/${ownerPrivate}`);
  await expect(memberPage.getByTestId("page-not-found")).toBeVisible();
  await expect(memberPage.getByTestId("page-image")).toHaveCount(0);
  await memberPage.goto(`/print/${ownerPrivate}`);
  await expect(memberPage.getByTestId("page-not-found")).toBeVisible();

  // Gallery shows only shared pages.
  await memberPage.goto("/gallery");
  await expect(memberPage.getByTestId("gallery-card")).toHaveCount(1);
  await expect(memberPage.getByTestId("gallery-card").first()).toContainText("Moon rocket");

  // A shared page of someone else offers no owner or admin actions to a member.
  await memberPage.goto(`/pages/${ownerShared}`);
  await expect(memberPage.getByTestId("page-image")).toBeVisible();
  for (const id of ["rename", "delete", "publish", "unpublish", "remove-from-gallery"]) await expect(memberPage.getByTestId(id)).toHaveCount(0);

  // The server refuses changes to another member's pages, whatever the request says.
  await memberPage.goto(`/pages/${memberOwn}`);
  await memberPage.getByTestId("rename").click();
  await memberPage.getByTestId("title-input").fill("Puppy in boots");
  const rename = await capture(memberPage, () => memberPage.getByTestId("save-title").click());
  await expect(memberPage.getByTestId("page-title")).toHaveText("Puppy in boots");
  // The same call for one's own page goes through, so the refusals below are the ownership rule.
  expect(await replay(rename, "member", "Puppy in boots", "Puppy in red boots")).toBe(false);
  expect((await rows(runtime, "select title from pages where id = ?", memberOwn))[0].title).toBe("Puppy in red boots");
  for (const target of [ownerPrivate, ownerShared]) {
    expect(await replay(rename, "member", memberOwn, target)).toBe(true);
  }
  expect((await rows(runtime, "select title from pages where id = ?", ownerShared))[0].title).toBe("Moon rocket");

  await memberPage.getByTestId("publish").click();
  await memberPage.getByTestId("gallery-title").fill("Puppy in boots");
  await memberPage.getByTestId("gallery-theme").click();
  await memberPage.getByRole("option", { name: "Animals" }).click();
  const publishCall = await capture(memberPage, () => memberPage.getByTestId("save-gallery").click());
  await expect(memberPage.getByTestId("gallery-badge")).toContainText("Animals");
  expect(await replay(publishCall, "member", memberOwn, ownerPrivate)).toBe(true);
  expect((await rows(runtime, "select published_at from pages where id = ?", ownerPrivate))[0].published_at).toBeNull();

  const unpublishCall = await capture(memberPage, () => memberPage.getByTestId("unpublish").click());
  await expect(memberPage.getByTestId("gallery-badge")).toHaveCount(0);
  expect(await replay(unpublishCall, "member", memberOwn, ownerShared)).toBe(true);
  expect((await rows(runtime, "select published_at from pages where id = ?", ownerShared))[0].published_at).not.toBeNull();

  // Server-side validation of the generator's fixed choices and prompt length.
  await memberPage.goto("/");
  await memberPage.getByTestId("prompt-input").fill("A kite over the hills");
  const generateCall = await capture(memberPage, () => memberPage.getByTestId("generate").click());
  await expect(memberPage.getByTestId("result-image")).toBeVisible({ timeout: 30_000 });
  const before = (await rows(runtime, "select id from pages where user_id = 'member'")).length;
  expect(await replay(generateCall, "member", "A kite over the hills", "x".repeat(301))).toBe(true);
  expect(await replay(generateCall, "member", '"kids"', '"wizard"')).toBe(true);
  expect((await rows(runtime, "select id from pages where user_id = 'member'")).length).toBe(before);

  // An admin removes a member's gallery entry; the member's page stays theirs.
  await memberPage.goto(`/pages/${memberOwn}`);
  await memberPage.getByTestId("publish").click();
  await memberPage.getByTestId("gallery-title").fill("Puppy in boots");
  await memberPage.getByTestId("gallery-theme").click();
  await memberPage.getByRole("option", { name: "Animals" }).click();
  await memberPage.getByTestId("save-gallery").click();
  await expect(memberPage.getByTestId("gallery-badge")).toContainText("Animals");
  await ownerPage.goto(`/pages/${memberOwn}`);
  for (const id of ["rename", "delete", "publish"]) await expect(ownerPage.getByTestId(id)).toHaveCount(0);
  await ownerPage.getByTestId("remove-from-gallery").click();
  await ownerPage.getByTestId("confirm-remove").click();
  await expect(ownerPage.getByTestId("page-not-found")).toBeVisible();
  const memberRow = (await rows(runtime, "select published_at, user_id from pages where id = ?", memberOwn))[0];
  expect(memberRow).toMatchObject({ published_at: null, user_id: "member" });

  // Deleting someone else's page is refused.
  await generate(memberPage, "A snail racing a turtle");
  const spare = await idOf("member", "A snail racing a turtle");
  await memberPage.goto(`/pages/${spare}`);
  await memberPage.getByTestId("delete").click();
  const deleteCall = await capture(memberPage, () => memberPage.getByTestId("confirm-delete").click());
  await expect(memberPage).toHaveURL(/\/history$/);
  expect(await replay(deleteCall, "member", spare, ownerShared)).toBe(true);
  expect(await rows(runtime, "select id from pages where id = ?", ownerShared)).toHaveLength(1);
  expect((await runtime.fetch(`/files/${ownerShared}`, { role: "owner" })).status).toBe(200);

  // No sign-in of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/logout", "/register"]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status).toBe(404);
  }
  await memberPage.goto("/");
  await expect(memberPage.locator('input[type="password"]')).toHaveCount(0);
  const outsider = await (await runtime.context("outsider")).newPage();
  const visit = await outsider.goto("/");
  expect([401, 403]).toContain(visit.status());
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
