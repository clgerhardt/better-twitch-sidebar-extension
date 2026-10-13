import { test, expect } from "./extension";

// Signed in to Twitch, extension not connected: one compact block with a Connect button for that
// account, no groups and no Manage Groups button, and nothing that sends the user to Twitch's login.
const disconnect = (worker: any) =>
  worker.evaluate(async () => {
    const { globalState } = await chrome.storage.local.get("globalState");
    await chrome.storage.local.remove(["twitchToken", "twitchUserId", "twitchUserImage", "tokenExpiresAt", "channelSnapshot"]);
    await chrome.storage.local.set({ globalState: { ...globalState, loggedIn: false } });
  });

test("not connected: the sidebar offers to connect the account signed in to Twitch", async ({ session, worker, openTwitch }) => {
  await disconnect(worker);
  const page = await openTwitch();

  const view = page.getByTestId("not-connected-view");
  await expect(view).toContainText("Connect to group your followed channels");
  await expect(view.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();
  await expect(page.locator("#__root")).not.toContainText("Ungrouped");
  await expect(page.locator("#__manage-groups-root")).not.toContainText("Manage Groups");
  // The old view sent people to Twitch's own login page
  await expect(view.locator("a")).toHaveCount(0);
  await expect(page.locator("#__root")).not.toContainText("not logged in");
});

test("the sidebar's Connect button connects and the groups appear", async ({ session, context, worker, openTwitch }) => {
  await disconnect(worker);
  await worker.evaluate(() => {
    (chrome.identity as any).launchWebAuthFlow = (_o: unknown, cb: (url?: string) => void) =>
      cb("https://fixture.chromiumapp.org/#access_token=connected-token&scope=user%3Aread%3Afollows&token_type=bearer");
  });
  const page = await openTwitch();

  await page.getByTestId("not-connected-view").getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(page.locator("#__root")).toContainText("Ungrouped", { timeout: 8_000 });
  await expect(page.getByTestId("not-connected-view")).toHaveCount(0);
  await expect(page.locator("#__manage-groups-root")).toContainText("Manage Groups");
  expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBe("connected-token");
});

test("a refused connection says why in the sidebar", async ({ session, context, worker, openTwitch }) => {
  await disconnect(worker);
  await context.route("https://id.twitch.tv/oauth2/validate", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ user_id: "123", expires_in: 5_000_000 }) }));
  await context.route("https://id.twitch.tv/oauth2/revoke", (route) => route.fulfill({ status: 200, body: "" }));
  await worker.evaluate(() => {
    (chrome.identity as any).launchWebAuthFlow = (_o: unknown, cb: (url?: string) => void) =>
      cb("https://fixture.chromiumapp.org/#access_token=other-token&scope=user%3Aread%3Afollows&token_type=bearer");
  });
  const page = await openTwitch();

  await page.getByTestId("not-connected-view").getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(page.getByTestId("not-connected-view")).toContainText("not the account signed in to Twitch", { timeout: 8_000 });
  expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
});

test("not connected and the account cannot be read: no button, and it says so", async ({ session, context, worker, openTwitch }) => {
  await disconnect(worker);
  await context.clearCookies({ name: "twilight-user" });
  await context.addCookies([{ name: "twilight-user", value: "%7Bnot-json", url: "https://www.twitch.tv/" }]);
  const page = await openTwitch();

  const view = page.getByTestId("not-connected-view");
  await expect(view).toContainText("Could not tell which Twitch account is signed in");
  await expect(view.getByRole("button")).toHaveCount(0);
});

test("not connected and signed out of Twitch: the sidebar asks to sign in to Twitch", async ({ session, context, worker, openTwitch }) => {
  await disconnect(worker);
  await context.clearCookies({ name: "twilight-user" });
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Sign in to Twitch to see your groups");
  await expect(page.getByTestId("not-connected-view")).toHaveCount(0);
});
