import { test, expect } from "./extension";
import type { BrowserContext } from "@playwright/test";

const signInAs = async (context: BrowserContext, id: string, login: string) => {
  await context.clearCookies({ name: "twilight-user" });
  await context.addCookies([{ name: "twilight-user", value: encodeURIComponent(JSON.stringify({ id, login })), url: "https://www.twitch.tv/" }]);
};
const showTab = (page: any) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

const seedAccountData = (worker: any) =>
  worker.evaluate(() =>
    chrome.storage.local.set({
      groupNames: ["Friends"],
      channelGroups: { fixture_live: "Friends" },
      channelSnapshot: { version: 1, user: { id: "999" }, fetchedAt: Date.now(), staticAt: Date.now(), channels: [] },
    })
  );

test("another account signing in on Twitch clears the connected account's data", async ({ context, session, worker, openTwitch }) => {
  const revokes: string[] = [];
  await context.route("https://id.twitch.tv/oauth2/revoke", (route) => {
    revokes.push(route.request().postData() ?? "");
    return route.fulfill({ status: 200, body: "" });
  });
  await seedAccountData(worker);
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Friends");

  await signInAs(context, "123", "someone_else");
  await showTab(page);

  await expect.poll(async () => (await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  for (const key of ["twitchUserId", "twitchUserImage", "groupNames", "channelGroups", "followedChannels", "channelSnapshot", "snapshotError"]) {
    expect(stored[key], key).toBeUndefined();
  }
  expect(stored.globalState.loggedIn).toBe(false);
  expect(stored.pageAccount).toMatchObject({ status: "signed_in", id: "123" });
  await expect.poll(() => revokes.length).toBe(1);
  expect(revokes[0]).toContain("token=fixture-token");

  // The sidebar no longer shows the previous account's groups
  await expect(page.locator("#__root")).not.toContainText("Friends");
});

test("the same account signing in again changes nothing", async ({ context, session, worker, openTwitch }) => {
  await seedAccountData(worker);
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Friends");
  await signInAs(context, "999", "fixture_viewer");
  await showTab(page);
  await page.waitForTimeout(800);

  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "groupNames"]));
  expect(stored.twitchToken).toBe("fixture-token");
  expect(stored.groupNames).toEqual(["Friends"]);
});

test("signing out of Twitch or an unreadable cookie never clears anything", async ({ context, session, worker, openTwitch }) => {
  await seedAccountData(worker);
  const page = await openTwitch();
  await context.clearCookies({ name: "twilight-user" });
  await showTab(page);
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("pageAccount")).pageAccount?.status)).toBe("signed_out");

  await context.addCookies([{ name: "twilight-user", value: "%7Bnot-json", url: "https://www.twitch.tv/" }]);
  await showTab(page);
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("pageAccount")).pageAccount?.status)).toBe("unknown");
  await page.waitForTimeout(500);

  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "groupNames"]));
  expect(stored.twitchToken).toBe("fixture-token");
  expect(stored.groupNames).toEqual(["Friends"]);
});

test("after a switch the popup offers to connect the new account, which starts empty", async ({ context, session, worker, openTwitch, extensionId }) => {
  await seedAccountData(worker);
  const page = await openTwitch();
  await signInAs(context, "123", "someone_else");
  await showTab(page);
  await expect.poll(async () => (await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();

  // Twitch now says tokens belong to the new account
  await context.route("https://id.twitch.tv/oauth2/validate", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ user_id: "123", expires_in: 5_000_000 }) }));
  await context.route("https://api.twitch.tv/helix/users*", (route) =>
    new URL(route.request().url()).searchParams.has("id")
      ? route.fallback()
      : route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [{ id: "123", login: "someone_else", display_name: "Someone_Else", profile_image_url: "" }] }) })
  );
  await worker.evaluate(() => {
    (chrome.identity as any).launchWebAuthFlow = (_o: unknown, cb: (url?: string) => void) =>
      cb("https://fixture.chromiumapp.org/#access_token=new-token&scope=user%3Aread%3Afollows&token_type=bearer");
  });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await expect(popup.getByText("signed in to Twitch as someone_else")).toBeVisible();
  await popup.getByRole("button", { name: "Connect for someone_else" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "twitchUserId", "groupNames", "channelGroups"]));
  expect(stored.twitchToken).toBe("new-token");
  expect(stored.twitchUserId).toBe("123");
  expect(stored.groupNames).toBeUndefined();
  expect(stored.channelGroups).toBeUndefined();
});
