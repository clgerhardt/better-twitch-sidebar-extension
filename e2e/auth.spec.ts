import { test, expect } from "./extension";
import type { Page, Worker } from "@playwright/test";

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

test("logging out revokes the token with Twitch", async ({ twitchPage, context, extensionId }) => {
  const revokes: string[] = [];
  await context.route("https://id.twitch.tv/oauth2/revoke", (route) => {
    revokes.push(`${route.request().method()} ${route.request().postData()}`);
    return route.fulfill({ status: 200, body: "" });
  });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();

  await expect.poll(() => revokes.length).toBe(1);
  expect(revokes[0]).toMatch(/^POST /);
  expect(revokes[0]).toContain("token=fixture-token");
  expect(revokes[0]).toMatch(/client_id=/);
});

test("a revoke failure does not block logging out", async ({ twitchPage, context, worker, extensionId }) => {
  await context.route("https://id.twitch.tv/oauth2/revoke", (route) => route.abort());
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();
  expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
});

// The interactive login runs in the service worker (the toolbar popup closes as soon as the
// Twitch window takes focus). Stub its login window and the Helix user lookup there.
const stubWorkerLogin = (worker: Worker, redirect: string | null) =>
  worker.evaluate((redirectUrl) => {
    const g = self as any;
    g.__authCalls = [];
    (chrome.identity as any).launchWebAuthFlow = (options: { url: string; interactive: boolean }, callback: (url?: string) => void) => {
      g.__authCalls.push({ interactive: options.interactive, url: options.url });
      callback(redirectUrl ?? undefined);
    };
    const realFetch = g.fetch.bind(self);
    g.fetch = (input: any, init?: any) =>
      /api\.twitch\.tv\/helix\/users/.test(String(input))
        ? Promise.resolve(new Response(JSON.stringify({ data: [{ id: "999", login: "fixture_viewer", display_name: "Fixture_Viewer", profile_image_url: "https://img.example/viewer.png" }] }), { status: 200 }))
        : realFetch(input, init);
  }, redirect);

const authCalls = (worker: Worker) => worker.evaluate(() => (self as any).__authCalls as { interactive: boolean; url: string }[]);

const openPopup = async (context: any, extensionId: string) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  return popup;
};

// A session that was never logged out: no token and no logged-out flag
const clearSession = (worker: Worker) =>
  worker.evaluate(() => chrome.storage.local.remove(["twitchToken", "tokenIssuedAt", "twitchUserId", "twitchUserImage", "twitchLoggedOut"]));

test("Connect runs in the background and stores the session", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await stubWorkerLogin(worker, REDIRECT);
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.twitchToken).toBe("silent-token");
  expect(stored.twitchUserId).toBe("999");
  expect(stored.twitchUserImage).toBe("https://img.example/viewer.png");
  expect(stored.twitchLoggedOut).toBe(false);
  expect(stored.globalState.loggedIn).toBe(true);
  expect((await authCalls(worker)).filter((c) => c.interactive)).toHaveLength(1);
});

test("the first Connect uses Twitch's authorize page and forces re-verification", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await stubWorkerLogin(worker, REDIRECT);
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const url = new URL((await authCalls(worker))[0].url);
  expect(url.origin + url.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
  expect(url.searchParams.get("force_verify")).toBe("true");
  expect(url.searchParams.get("response_type")).toBe("token");
});

test("Connect after a logout signs out of Twitch first, then authorizes", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();

  await stubWorkerLogin(worker, REDIRECT);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const url = new URL((await authCalls(worker))[0].url);
  expect(url.origin + url.pathname).toBe("https://id.twitch.tv/logout/redirect");
  expect(url.searchParams.get("redirect_path")).toBe("https://id.twitch.tv/oauth2/authorize/data");
  // The authorize request Twitch continues with after signing the browser out
  const next = new URLSearchParams(url.searchParams.get("redirect_params")!);
  expect(next.get("client_id")).toBeTruthy();
  expect(next.get("response_type")).toBe("token");
  expect(next.get("scope")).toBe("user:read:follows");
  expect(next.get("force_verify")).toBe("true");
  expect(next.get("redirect_uri")).toMatch(/^https:\/\/[a-z]{32}\.chromiumapp\.org\/$/);
});

test("cancelling the Twitch login leaves the popup ready to try again", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await stubWorkerLogin(worker, null); // the login window was closed
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();

  await expect(popup.getByText(/could not connect/i)).toBeVisible({ timeout: 5_000 });
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeEnabled();
  expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
});

// Shared machines: nothing the previous account created may be visible to the next one
test("logging out clears the account's groups and cached follow list", async ({ twitchPage, context, worker, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Zebra Squad"], channelGroups: { fixture_live: "Zebra Squad" } }));
  await expect(twitchPage.locator("#__root")).toContainText("Zebra Squad");
  expect(Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)))).toContain("followedChannels");

  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();

  const keys = Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)));
  for (const key of ["groupNames", "channelGroups", "followedChannels", "twitchToken", "twitchUserId", "twitchUserImage"]) {
    expect(keys, `${key} should be cleared`).not.toContain(key);
  }
});

test("the next account to connect starts with no groups", async ({ twitchPage, context, worker, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Zebra Squad"], channelGroups: { fixture_live: "Zebra Squad" } }));
  await expect(twitchPage.locator("#__root")).toContainText("Zebra Squad");

  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();

  await stubWorkerLogin(worker, REDIRECT);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  await expect(twitchPage.locator("#__root [role=button]")).toHaveCount(1, { timeout: 5_000 }); // only Ungrouped
  await expect(twitchPage.locator("#__root")).not.toContainText("Zebra Squad");
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  await expect(twitchPage.getByRole("dialog")).not.toContainText("Zebra Squad");
});

test("after connecting, the sidebar shows loading and not the logged-out intro while channels download", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();
  await expect(twitchPage.locator("#__root")).toContainText("not logged in");

  // A slow follow list, like the real Twitch API
  await context.route("https://api.twitch.tv/helix/channels/followed*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fallback();
  });
  await stubWorkerLogin(worker, REDIRECT);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  // Mid-download: the account is connected, so the intro must be gone
  await twitchPage.waitForTimeout(400);
  const sidebarText = await twitchPage.locator("#__root").innerText();
  expect(sidebarText).not.toContain("not logged in");
  expect(sidebarText).toContain("Loading");

  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped", { timeout: 8_000 });
});
