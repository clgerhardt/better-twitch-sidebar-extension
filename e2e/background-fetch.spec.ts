import { test, expect } from "./extension";
import type { BrowserContext } from "@playwright/test";

// Records every Twitch API call (page and service worker) while still letting the stub answer it
const trackApiCalls = async (context: BrowserContext) => {
  const calls: string[] = [];
  await context.route("https://api.twitch.tv/helix/**", (route) => {
    calls.push(new URL(route.request().url()).pathname.replace("/helix/", ""));
    return route.fallback();
  });
  return calls;
};

const snapshotOf = (worker: any) => worker.evaluate(async () => (await chrome.storage.local.get("channelSnapshot")).channelSnapshot);

test("the page makes no Twitch API calls; the background fetches and stores a snapshot", async ({ context, session, worker }) => {
  const page = await context.newPage();
  const pageCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://api.twitch.tv/")) pageCalls.push(request.url());
  });
  await page.goto("https://www.twitch.tv/");
  await expect(page.locator("#__root")).toContainText("Ungrouped");

  await expect.poll(() => snapshotOf(worker).then((s: any) => s?.channels.map((c: any) => c.login))).toEqual([
    "fixture_live",
    "fixturestreak",
    "fixture_offline",
  ]);
  const snapshot = await snapshotOf(worker);
  expect(snapshot.user).toEqual({ id: "999" });
  expect(snapshot.channels[0]).toMatchObject({ isLive: true, game: "Lootbound", viewers: 1100 });
  expect(snapshot.channels[2]).toMatchObject({ isLive: false, viewers: 0 });
  expect(pageCalls).toEqual([]);
});

test("tabs loading together share one refresh", async ({ context, session, openTwitch }) => {
  const calls = await trackApiCalls(context);
  const first = await openTwitch();
  const second = await openTwitch();
  await expect(first.locator("#__root")).toContainText("Ungrouped");
  await expect(second.locator("#__root")).toContainText("Ungrouped");

  expect(calls.filter((c) => c === "channels/followed")).toHaveLength(1);
  expect(calls.filter((c) => c === "users")).toHaveLength(1);
  expect(calls.filter((c) => c === "streams/followed")).toHaveLength(1);
});

test("a stored snapshot is shown immediately while a slow refresh runs", async ({ context, session, worker, openTwitch }) => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      channelSnapshot: {
        version: 1,
        user: { id: "999" },
        fetchedAt: 0,
        staticAt: Date.now(),
        channels: [{ id: "1", login: "fixture_live", displayName: "Fixture_Live", image: "", isLive: true, game: "Cached Game", viewers: 5 }],
      },
    })
  );
  await context.route("https://api.twitch.tv/helix/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.fallback();
  });

  const page = await openTwitch();
  const sidebar = page.locator("#__root");
  // Before Twitch answers, the last snapshot is already on screen
  await expect(sidebar.getByRole("button", { name: /Ungrouped/ })).toBeVisible({ timeout: 1_000 });
  await sidebar.getByRole("button", { name: /Ungrouped/ }).click();
  await expect(sidebar).toContainText("Cached Game", { timeout: 1_000 });
  // Then the refresh lands and replaces it
  await expect(sidebar).toContainText("Lootbound", { timeout: 8_000 });
});

test("a refresh that is still running when the user logs out writes nothing", async ({ context, session, worker, extensionId, openTwitch }) => {
  const page = await openTwitch();
  await expect.poll(() => snapshotOf(worker)).toBeTruthy();

  await context.route("https://api.twitch.tv/helix/streams/followed*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fallback();
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await popup.evaluate(() => void chrome.runtime.sendMessage({ type: "REFRESH_CHANNELS", force: true }));
  await popup.waitForTimeout(400); // the refresh is now waiting on Twitch
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect Twitch" })).toBeVisible();
  await page.waitForTimeout(3_000); // longer than the slow response

  const keys = Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)));
  expect(keys).not.toContain("channelSnapshot");
  expect(keys).not.toContain("snapshotError");
});

test("an expired login is reported in the sidebar", async ({ context, session, worker, openTwitch }) => {
  await context.route("https://api.twitch.tv/helix/channels/followed*", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Invalid OAuth token" }) })
  );
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("login expired", { timeout: 8_000 });
  expect((await worker.evaluate(() => chrome.storage.local.get("snapshotError"))).snapshotError).toBe("unauthorized");
});

// The service worker's quiet login: it returns this redirect, and Twitch's validate says whose token it is
const stubQuietLogin = async (context: BrowserContext, worker: any, validatedUserId: string) => {
  await context.route("https://id.twitch.tv/oauth2/validate", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user_id: validatedUserId, expires_in: 5_000_000 }) })
  );
  await context.route("https://api.twitch.tv/helix/**", (route) =>
    route.request().headers()["authorization"] === "Bearer fixture-token"
      ? route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Invalid OAuth token" }) })
      : route.fallback()
  );
  await worker.evaluate(() => {
    const g = self as any;
    g.__quietLogins = 0;
    (chrome.identity as any).launchWebAuthFlow = (options: { interactive: boolean }, cb: (url?: string) => void) => {
      if (options.interactive) return cb(undefined);
      g.__quietLogins++;
      cb("https://fixture.chromiumapp.org/#access_token=renewed-token&scope=user%3Aread%3Afollows&token_type=bearer");
    };
  });
};

test("a rejected token is renewed quietly in the background and the sidebar loads", async ({ context, session, worker, openTwitch }) => {
  await stubQuietLogin(context, worker, "999");
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("Ungrouped");
  await expect.poll(() => snapshotOf(worker).then((s: any) => s?.channels.length)).toBe(3);

  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "snapshotError", "tokenExpiresAt"]));
  expect(stored.twitchToken).toBe("renewed-token");
  expect(stored.snapshotError).toBeUndefined();
  expect(stored.tokenExpiresAt).toBeGreaterThan(Date.now() + 50 * 24 * 60 * 60 * 1000);
  expect(await worker.evaluate(() => (self as any).__quietLogins)).toBe(1);
});

test("a quiet login that returns a different account is refused", async ({ context, session, worker, openTwitch }) => {
  await stubQuietLogin(context, worker, "123");
  const page = await openTwitch();
  await expect(page.locator("#__root")).toContainText("login expired", { timeout: 8_000 });

  const stored = await worker.evaluate(() => chrome.storage.local.get(["twitchToken", "twitchUserId", "snapshotError"]));
  expect(stored.twitchToken).toBe("fixture-token");
  expect(stored.twitchUserId).toBe("999");
  expect(stored.snapshotError).toBe("unauthorized");
});

test("a Twitch outage keeps showing the last snapshot", async ({ context, session, worker, openTwitch }) => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      channelSnapshot: {
        version: 1,
        user: { id: "999" },
        fetchedAt: 0,
        staticAt: Date.now(),
        channels: [{ id: "1", login: "fixture_live", displayName: "Fixture_Live", image: "", isLive: true, game: "Cached Game", viewers: 5 }],
      },
    })
  );
  await context.route("https://api.twitch.tv/helix/**", (route) => route.fulfill({ status: 500, body: "{}" }));
  const page = await openTwitch();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("snapshotError")).snapshotError)).toBe("failed");
  await page.locator("#__root").getByRole("button", { name: /Ungrouped/ }).click();
  await expect(page.locator("#__root")).toContainText("Cached Game");
});

test("connecting fetches the channels right away", async ({ context, session, worker, extensionId }) => {
  await worker.evaluate(() => chrome.storage.local.remove(["twitchToken", "tokenExpiresAt", "twitchUserId", "twitchUserImage", "channelSnapshot"]));
  await worker.evaluate(() => {
    (chrome.identity as any).launchWebAuthFlow = (_o: unknown, cb: (url: string) => void) =>
      cb("https://fixture.chromiumapp.org/#access_token=connected-token&scope=user%3Aread%3Afollows&token_type=bearer");
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await popup.getByRole("button", { name: "Connect Twitch" }).click();
  await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 5_000 });

  // No Twitch tab is open, yet the snapshot is there
  await expect.poll(() => snapshotOf(worker).then((s: any) => s?.channels.length)).toBe(3);
  expect((await snapshotOf(worker)).user.id).toBe("999");
});

// Live refresh: the sidebar asks the background for fresh data while its tab is visible
const makeSnapshotStale = (worker: any) =>
  worker.evaluate(async () => {
    const { channelSnapshot } = await chrome.storage.local.get("channelSnapshot");
    await chrome.storage.local.set({ channelSnapshot: { ...channelSnapshot, fetchedAt: 0 } });
  });

// Twitch now says Fixture_Live has 2,222 viewers
const liveViewersChange = (context: BrowserContext) =>
  context.route("https://api.twitch.tv/helix/streams/followed*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ user_id: "1", user_login: "fixture_live", user_name: "Fixture_Live", game_name: "Lootbound", viewer_count: 2222, type: "live" }],
        pagination: {},
      }),
    })
  );

test("coming back to the tab refreshes it", async ({ context, session, worker, openTwitch }) => {
  const page = await openTwitch();
  await page.locator("#__root").getByRole("button", { name: /Ungrouped/ }).click();
  await expect(page.locator("#__root")).toContainText("1.1K viewers");

  await makeSnapshotStale(worker);
  await liveViewersChange(context);
  // What the browser fires when the user switches back to this tab
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await expect(page.locator("#__root")).toContainText("2.2K viewers", { timeout: 8_000 });
});
