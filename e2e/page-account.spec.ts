import { test, expect } from "./extension";
import type { BrowserContext } from "@playwright/test";

const cookie = (user: Record<string, unknown> | string) => ({
  name: "twilight-user",
  value: encodeURIComponent(typeof user === "string" ? user : JSON.stringify(user)),
  url: "https://www.twitch.tv/",
});
const viewer = { authToken: "secret-auth-token", displayName: "Fixture_Viewer", id: "999", login: "fixture_viewer" };

const stored = (worker: any) => worker.evaluate(async () => (await chrome.storage.local.get("pageAccount")).pageAccount);
const setCookie = async (context: BrowserContext, user: Record<string, unknown> | string | null) => {
  await context.clearCookies({ name: "twilight-user" });
  if (user !== null) await context.addCookies([cookie(user)]);
};

test("the signed-in Twitch account is stored for the rest of the extension", async ({ context, session, worker, openTwitch }) => {
  await setCookie(context, viewer);
  await openTwitch();
  await expect.poll(() => stored(worker)).toMatchObject({ status: "signed_in", id: "999", login: "fixture_viewer" });
  expect((await stored(worker)).seenAt).toBeGreaterThan(0);
});

test("the Twitch auth token from the cookie is never stored", async ({ context, session, worker, openTwitch }) => {
  await setCookie(context, viewer);
  await openTwitch();
  await expect.poll(() => stored(worker)).toBeDefined();
  expect(JSON.stringify(await worker.evaluate(() => chrome.storage.local.get(null)))).not.toContain("secret-auth-token");
});

test("no Twitch account signed in is recorded as signed out", async ({ context, session, worker, openTwitch }) => {
  await setCookie(context, null);
  await openTwitch();
  await expect.poll(() => stored(worker)).toMatchObject({ status: "signed_out" });
});

test("a cookie that cannot be read is recorded as unknown", async ({ context, session, worker, openTwitch }) => {
  await setCookie(context, "{not-json");
  await openTwitch();
  await expect.poll(() => stored(worker)).toMatchObject({ status: "unknown" });
});

test("switching accounts on Twitch is picked up when the tab is shown again", async ({ context, session, worker, openTwitch }) => {
  await setCookie(context, viewer);
  const page = await openTwitch();
  await expect.poll(() => stored(worker)).toMatchObject({ id: "999" });

  await setCookie(context, { ...viewer, id: "123", login: "someone_else" });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => stored(worker)).toMatchObject({ status: "signed_in", id: "123", login: "someone_else" });
});
