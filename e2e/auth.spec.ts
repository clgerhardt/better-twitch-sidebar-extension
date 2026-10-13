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

  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();
  await popup.waitForTimeout(1_500); // time for any silent re-login to run

  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.twitchToken).toBeUndefined();
  expect(stored.twitchUserId).toBeUndefined();
  expect(stored.globalState.loggedIn).toBe(false);
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();

  // The sidebar goes back to the logged-out view
  await expect(twitchPage.locator("#__root")).toContainText("Connect for fixture_viewer");
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
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();

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
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();
  expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
});

// The interactive login runs in the service worker (the toolbar popup closes as soon as the
// Twitch window takes focus). Stub its login window and the Helix user lookup there.
const stubWorkerLogin = (worker: Worker, redirect: string | null, validatedUserId = "999") =>
  worker.evaluate(({ redirectUrl, userId }) => {
    const g = self as any;
    g.__authCalls = [];
    (chrome.identity as any).launchWebAuthFlow = (options: { url: string; interactive: boolean }, callback: (url?: string) => void) => {
      g.__authCalls.push({ interactive: options.interactive, url: options.url });
      callback(redirectUrl ?? undefined);
    };
    const realFetch = g.fetch.bind(self);
    g.fetch = (input: any, init?: any) =>
      /id\.twitch\.tv\/oauth2\/validate/.test(String(input))
        ? Promise.resolve(new Response(JSON.stringify({ user_id: userId, expires_in: 4_881_074 }), { status: 200 }))
        : /api\.twitch\.tv\/helix\/users/.test(String(input))
        ? Promise.resolve(new Response(JSON.stringify({ data: [{ id: "999", login: "fixture_viewer", display_name: "Fixture_Viewer", profile_image_url: "https://img.example/viewer.png" }] }), { status: 200 }))
        : realFetch(input, init);
  }, { redirectUrl: redirect, userId: validatedUserId });

const authCalls = (worker: Worker) => worker.evaluate(() => (self as any).__authCalls as { interactive: boolean; url: string }[]);

const openPopup = async (context: any, extensionId: string) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  return popup;
};

// A session that was never logged out: no token and no logged-out flag
const clearSession = (worker: Worker) =>
  worker.evaluate(() => chrome.storage.local.remove(["twitchToken", "tokenExpiresAt", "twitchUserId", "twitchUserImage", "twitchLoggedOut"]));

test("Connect runs in the background and stores the session", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await stubWorkerLogin(worker, REDIRECT);
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.twitchToken).toBe("silent-token");
  expect(stored.twitchUserId).toBe("999");
  expect(stored.twitchUserImage).toBe("https://img.example/viewer.png");
  // The expiry is what Twitch reports (about 56 days here), not an assumed few hours
  expect(stored.tokenExpiresAt).toBeGreaterThan(Date.now() + 50 * 24 * 60 * 60 * 1000);
  expect(stored.twitchLoggedOut).toBe(false);
  expect(stored.globalState.loggedIn).toBe(true);
  expect((await authCalls(worker)).filter((c) => c.interactive)).toHaveLength(1);
});

test("a failed user lookup in the logged-out popup never removes the token", async ({ twitchPage, context, worker, extensionId }) => {
  await context.route("https://api.twitch.tv/helix/users*", (route) => route.abort());
  await clearSession(worker);
  await stubWorkerLogin(worker, REDIRECT);
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 }).catch(() => undefined);
  await popup.waitForTimeout(1_500);
  // The connection stands or is refused as a whole; the popup never half-removes it
  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "twitchUserId"]));
  expect(Boolean(stored.twitchToken)).toBe(Boolean(stored.twitchUserId));
});

test("Connect uses Twitch's plain authorize page: no forced re-verification, no sign-out", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await stubWorkerLogin(worker, REDIRECT);
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const url = new URL((await authCalls(worker))[0].url);
  expect(url.origin + url.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
  expect(url.searchParams.get("force_verify")).toBeNull();
  expect(url.searchParams.get("response_type")).toBe("token");
  expect(url.searchParams.get("scope")).toBe("user:read:follows");
});

test("Connect after a logout does not sign the user out of Twitch", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();

  await stubWorkerLogin(worker, REDIRECT);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  const urls = (await authCalls(worker)).map((c) => c.url);
  expect(urls).toHaveLength(1);
  expect(urls[0]).toMatch(/^https:\/\/id\.twitch\.tv\/oauth2\/authorize\?/);
  expect(urls.join(" ")).not.toContain("logout");
});

test("a login for a different account than the one signed in to Twitch is refused", async ({ twitchPage, context, worker, extensionId }) => {
  const revokes: string[] = [];
  await context.route("https://id.twitch.tv/oauth2/revoke", (route) => {
    revokes.push(route.request().postData() ?? "");
    return route.fulfill({ status: 200, body: "" });
  });
  await clearSession(worker);
  await stubWorkerLogin(worker, REDIRECT, "123"); // the token belongs to someone else
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();

  await expect(popup.getByText(/not the account signed in to Twitch/i)).toBeVisible({ timeout: 5_000 });
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeEnabled();
  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(stored.twitchToken).toBeUndefined();
  expect(stored.twitchUserId).toBeUndefined();
  expect(stored.channelSnapshot).toBeUndefined();
  // The other account's token is not kept around
  await expect.poll(() => revokes.length).toBe(1);
  expect(revokes[0]).toContain("token=silent-token");
});

test("Connect needs a Twitch account signed in on twitch.tv", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await worker.evaluate(() => chrome.storage.local.set({ pageAccount: { status: "signed_out", seenAt: Date.now() } }));
  await stubWorkerLogin(worker, REDIRECT);
  const popup = await openPopup(context, extensionId);

  await expect(popup.getByText("Sign in to Twitch in a tab")).toBeVisible();
  await expect(popup.getByRole("button", { name: /^Connect/ })).toHaveCount(0);
  // The background refuses too, whatever the popup shows
  expect(await popup.evaluate(() => chrome.runtime.sendMessage({ type: "CONNECT_TWITCH" }))).toEqual({ ok: false, reason: "not_signed_in" });
  expect(await authCalls(worker)).toHaveLength(0);
});

test("Connect is not offered before any Twitch tab has been seen", async ({ session, context, worker, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.remove(["twitchToken", "pageAccount"]));
  const popup = await openPopup(context, extensionId);
  await expect(popup.getByText("Open Twitch in a tab")).toBeVisible();
  await expect(popup.getByRole("button", { name: /^Connect/ })).toHaveCount(0);
});

test("cancelling the Twitch login leaves the popup ready to try again", async ({ twitchPage, context, worker, extensionId }) => {
  await clearSession(worker);
  await stubWorkerLogin(worker, null); // the login window was closed
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();

  await expect(popup.getByText(/could not connect/i)).toBeVisible({ timeout: 5_000 });
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeEnabled();
  expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
});

// Shared machines: nothing the previous account created may be visible to the next one
test("logging out clears the account's groups and cached follow list", async ({ twitchPage, context, worker, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Zebra Squad"], channelGroups: { fixture_live: "Zebra Squad" } }));
  await expect(twitchPage.locator("#__root")).toContainText("Zebra Squad");
  expect(Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)))).toContain("followedChannels");
  await expect.poll(async () => Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)))).toContain("channelSnapshot");

  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();

  const keys = Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)));
  for (const key of ["groupNames", "channelGroups", "followedChannels", "channelSnapshot", "snapshotError", "twitchToken", "twitchUserId", "twitchUserImage"]) {
    expect(keys, `${key} should be cleared`).not.toContain(key);
  }
});

test("the next account to connect starts with no groups", async ({ twitchPage, context, worker, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Zebra Squad"], channelGroups: { fixture_live: "Zebra Squad" } }));
  await expect(twitchPage.locator("#__root")).toContainText("Zebra Squad");

  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();

  await stubWorkerLogin(worker, REDIRECT);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  await expect(twitchPage.locator("#__root [role=button]")).toHaveCount(1, { timeout: 5_000 }); // only Ungrouped
  await expect(twitchPage.locator("#__root")).not.toContainText("Zebra Squad");
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  await expect(twitchPage.getByRole("dialog")).not.toContainText("Zebra Squad");
});

test("after connecting, the sidebar shows loading and not the logged-out intro while channels download", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();
  await expect(twitchPage.locator("#__root")).toContainText("Connect for fixture_viewer");

  // A slow follow list, like the real Twitch API
  await context.route("https://api.twitch.tv/helix/channels/followed*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fallback();
  });
  await stubWorkerLogin(worker, REDIRECT);
  await popup.getByRole("button", { name: "Connect for fixture_viewer" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  // Mid-download: the account is connected, so the intro must be gone
  await twitchPage.waitForTimeout(400);
  const sidebarText = await twitchPage.locator("#__root").innerText();
  expect(sidebarText).not.toContain("Connect for");
  expect(sidebarText).toContain("Loading");

  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped", { timeout: 8_000 });
});

// A failed user lookup in the popup must never log the user out or delete their groups. A rejected
// token is dealt with by the background, which shows the reconnect view.
for (const [name, fulfill] of [
  ["a network failure", (route: any) => route.abort()],
  ["a server error", (route: any) => route.fulfill({ status: 500, body: "" })],
  ["a rate limit", (route: any) => route.fulfill({ status: 429, body: "" })],
  ["a rejected token", (route: any) => route.fulfill({ status: 401, body: "" })],
] as const) {
  test(`${name} while opening the popup keeps the session and groups`, async ({ twitchPage, context, worker, extensionId }) => {
    await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");
    await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Friends"] }));
    await context.route("https://api.twitch.tv/helix/users*", fulfill);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
    await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible();
    await popup.waitForTimeout(1_000);

    const stored = await worker.evaluate(() => chrome.storage.local.get(null));
    expect(stored.twitchToken).toBeDefined();
    expect(stored.groupNames).toEqual(["Friends"]);
    expect(stored.twitchLoggedOut).toBeFalsy();
    await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible();
  });
}

const guestPopup = async (context: any, worker: Worker, extensionId: string, pageAccount: unknown) => {
  await worker.evaluate((account) => chrome.storage.local.set({ pageAccount: account }), pageAccount);
  const popup = await openPopup(context, extensionId);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toHaveCount(0);
  return popup;
};

test("the logged-out popup names the Twitch account that is signed in", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await guestPopup(context, worker, extensionId, { status: "signed_in", id: "999", login: "fixture_viewer", seenAt: Date.now() });
  await expect(popup.getByText("You're signed in to Twitch as fixture_viewer")).toBeVisible();
  await expect(popup.getByText(/need to login to twitch/i)).toHaveCount(0);
});

test("the logged-out popup asks to sign in to Twitch when nobody is signed in", async ({ twitchPage, context, worker, extensionId }) => {
  const popup = await guestPopup(context, worker, extensionId, { status: "signed_out", seenAt: Date.now() });
  await expect(popup.getByText("Sign in to Twitch in a tab")).toBeVisible();
});
