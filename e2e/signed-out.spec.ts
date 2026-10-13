import { test, expect } from "./extension";
import type { BrowserContext } from "@playwright/test";

// Signed out of Twitch while the extension is still connected: hide and pause. Nothing is deleted,
// so the same account signing back in gets everything back.
const signOutOfTwitch = (context: BrowserContext) => context.clearCookies({ name: "twilight-user" });
const signInToTwitch = (context: BrowserContext) =>
  context.addCookies([{ name: "twilight-user", value: encodeURIComponent(JSON.stringify({ id: "999", login: "fixture_viewer" })), url: "https://www.twitch.tv/" }]);
const showTab = (page: any) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test("signed out of Twitch: no groups, no Manage Groups, and a line saying why", async ({ context, session, worker, openTwitch }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Friends"] }));
  await signOutOfTwitch(context);
  const page = await openTwitch();

  await expect(page.locator("#__root")).toContainText("Sign in to Twitch to see your groups");
  await expect(page.locator("#__root")).not.toContainText("Ungrouped");
  await expect(page.locator("#__root")).not.toContainText("Friends");
  await expect(page.locator("#__manage-groups-root")).not.toContainText("Manage Groups");

  // Nothing was deleted
  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "twitchUserId", "groupNames"]));
  expect(stored.twitchToken).toBe("fixture-token");
  expect(stored.twitchUserId).toBe("999");
  expect(stored.groupNames).toEqual(["Friends"]);
});

test("while signed out of Twitch, no Twitch API calls are made", async ({ context, session, openTwitch, extensionId }) => {
  const calls: string[] = [];
  await context.route("https://api.twitch.tv/helix/**", (route) => {
    calls.push(route.request().url());
    return route.fallback();
  });
  await signOutOfTwitch(context);
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Sign in to Twitch");
  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/src/pages/options/index.html`);
  expect(await extensionPage.evaluate(() => chrome.runtime.sendMessage({ type: "REFRESH_CHANNELS", force: true }))).toEqual({ ok: false, reason: "paused" });
  await page.waitForTimeout(800);
  expect(calls).toEqual([]);
});

test("signing back in as the same account brings the groups back", async ({ context, session, worker, openTwitch }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Friends"] }));
  await signOutOfTwitch(context);
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Sign in to Twitch to see your groups");

  await signInToTwitch(context);
  await showTab(page);
  await expect(page.locator("#__root")).toContainText("Friends");
  await expect(page.locator("#__manage-groups-root")).toContainText("Manage Groups");
  await expect(page.locator("#__root")).not.toContainText("Sign in to Twitch");
});

test("signing out of Twitch in another tab is picked up when this tab is shown", async ({ context, session, openTwitch }) => {
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Ungrouped");
  await signOutOfTwitch(context);
  await showTab(page);
  await expect(page.locator("#__root")).toContainText("Sign in to Twitch to see your groups");
});

test("the popup says the user is signed out of Twitch and still offers Logout", async ({ context, session, worker, openTwitch, extensionId }) => {
  await signOutOfTwitch(context);
  await openTwitch();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("pageAccount")).pageAccount?.status)).toBe("signed_out");

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await expect(popup.getByText("signed out of Twitch")).toBeVisible();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible();
});
