import { test, expect } from "./extension";
import type { Page } from "@playwright/test";

const REDIRECT = "https://fixture.chromiumapp.org/#access_token=silent-token&scope=user%3Aread%3Afollows&token_type=bearer";

// Make chrome.identity behave as if the browser still has a Twitch session: both the silent
// and the interactive login succeed straight away.
const fakeTwitchSession = (popup: Page) =>
  popup.evaluate((redirect) => {
    (chrome.identity as any).launchWebAuthFlow = (_options: unknown, callback: (url: string) => void) => callback(redirect);
  }, REDIRECT);

test("logging out stays logged out, even while Twitch still has a session", async ({ twitchPage, context, worker, extensionId }) => {
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await fakeTwitchSession(popup);
  await popup.getByRole("button", { name: "Logout" }).click();

  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();
  await popup.waitForTimeout(1_500); // time for any silent re-login to run

  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.twitchToken).toBeUndefined();
  expect(stored.twitchUserId).toBeUndefined();
  expect(stored.globalState.loggedIn).toBe(false);
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();

  // The sidebar goes back to the logged-out view
  await expect(twitchPage.locator("#__root")).toContainText("not logged in");
});

test("connecting again after a logout works", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await fakeTwitchSession(popup);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();

  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.twitchToken).toBe("silent-token");
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped", { timeout: 5_000 });
});
