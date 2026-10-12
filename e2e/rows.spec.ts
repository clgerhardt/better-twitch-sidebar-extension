import { test, expect } from "./extension";
import type { BrowserContext, Page } from "@playwright/test";

// The fixture page has Twitch's own rows in its (hidden) Followed Channels section, including a
// Watch Streak row and an offline row. The stub says: fixture_live and fixturestreak are live,
// fixture_offline is not.

const openGroup = async (page: Page) => {
  await page.locator("#__root").getByRole("button", { name: /Ungrouped/ }).click();
  await expect(page.locator("#__root a.side-nav-card__link").first()).toBeVisible();
};
const rowFor = (page: Page, login: string) => page.locator(`#__root a.side-nav-card__link[href="/${login}"]`);

const seedChannels = (worker: any, channels: object[]) =>
  worker.evaluate(async (list: object[]) => {
    const now = Date.now();
    await chrome.storage.local.set({ channelSnapshot: { version: 1, user: { id: "999" }, fetchedAt: now, staticAt: now, channels: list } });
  }, channels);

// Twitch is unreachable, so the seeded snapshot is not replaced
const twitchDown = (context: BrowserContext) => context.route("https://api.twitch.tv/helix/**", (route) => route.fulfill({ status: 500, body: "{}" }));

const channel = (login: string, displayName: string, over: Record<string, unknown> = {}) => ({
  id: login, login, displayName, image: "", isLive: false, game: "", viewers: 0, ...over,
});

test("channels are shown as Twitch's own rows", async ({ twitchPage }) => {
  await openGroup(twitchPage);
  const live = rowFor(twitchPage, "fixture_live");
  await expect(live.locator("[data-a-target=side-nav-title]")).toHaveText("Fixture_Live");
  await expect(live.locator(".tw-channel-status-indicator")).toHaveCount(1);
  await expect(live).toContainText("Lootbound");
  await expect(live).toContainText("1.1K viewers");
});

test("badges on Twitch's own row are kept", async ({ twitchPage }) => {
  await openGroup(twitchPage);
  await expect(rowFor(twitchPage, "fixturestreak")).toContainText("Watch Streak");
});

test("offline channels look offline, like Twitch's offline rows", async ({ twitchPage }) => {
  await openGroup(twitchPage);
  const offline = rowFor(twitchPage, "fixture_offline");
  await expect(offline).toHaveClass(/side-nav-card__link--offline/);
  await expect(offline.locator(".side-nav-card__avatar--offline")).toHaveCount(1);
  await expect(offline).toContainText("Offline");
  await expect(offline.locator(".tw-channel-status-indicator")).toHaveCount(0);
  await expect(offline).not.toContainText("viewers");
});

test("a channel Twitch rendered no row for gets a live and an offline row from the template", async ({ context, session, worker, openTwitch }) => {
  await seedChannels(worker, [
    channel("nonative_live", "NoNative_Live", { isLive: true, game: "Template Game", viewers: 7 }),
    channel("nonative_off", "NoNative_Off"),
  ]);
  await twitchDown(context);
  const page = await openTwitch();
  await openGroup(page);

  const live = rowFor(page, "nonative_live");
  await expect(live.locator("[data-a-target=side-nav-title]")).toHaveText("NoNative_Live");
  await expect(live.locator(".tw-channel-status-indicator")).toHaveCount(1);
  await expect(live).toContainText("Template Game");
  await expect(live).toContainText("7 viewers");
  await expect(live).not.toContainText("Watch Streak");

  const off = rowFor(page, "nonative_off");
  await expect(off).toHaveClass(/side-nav-card__link--offline/);
  await expect(off).toContainText("Offline");
});

test("clicking a row uses Twitch's own link when Twitch has a row for that channel", async ({ twitchPage }) => {
  await openGroup(twitchPage);
  const url = twitchPage.url();
  // Stand in for Twitch's in-app navigation: it handles the click on its own row
  await twitchPage.evaluate(() => {
    (window as any).__nativeClicks = [];
    const native = document.querySelector("[aria-label='Followed Channels'] a[href='/fixturestreak']")!;
    native.addEventListener("click", (e) => {
      e.preventDefault();
      (window as any).__nativeClicks.push(native.getAttribute("href"));
    });
  });
  await rowFor(twitchPage, "fixturestreak").click();
  expect(await twitchPage.evaluate(() => (window as any).__nativeClicks)).toEqual(["/fixturestreak"]);
  expect(twitchPage.url()).toBe(url);
});

test("clicking a row Twitch has no row for opens the channel", async ({ context, session, worker, openTwitch }) => {
  await seedChannels(worker, [channel("nonative_live", "NoNative_Live", { isLive: true, game: "G", viewers: 1 })]);
  await twitchDown(context);
  await context.route("https://twitch.tv/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>channel</title>" }));
  const page = await openTwitch();
  await openGroup(page);
  await Promise.all([page.waitForURL(/twitch\.tv\/NoNative_Live/), rowFor(page, "nonative_live").click()]);
});

test("the last template is remembered and used when a page has no Twitch rows", async ({ context, session, worker, openTwitch }) => {
  await openTwitch(); // a page with Twitch rows: the template is captured and stored
  await expect.poll(() => worker.evaluate(async () => !!(await chrome.storage.local.get("rowTemplate")).rowTemplate)).toBe(true);

  await seedChannels(worker, [channel("nonative_live", "NoNative_Live", { isLive: true, game: "G", viewers: 3 })]);
  await twitchDown(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("a[data-a-id^=followed-channel]").forEach((a) => a.remove()));
  });
  await page.goto("https://www.twitch.tv/");
  await page.locator("#__root").waitFor();
  await openGroup(page);
  await expect(rowFor(page, "nonative_live").locator("[data-a-target=side-nav-title]")).toHaveText("NoNative_Live");
});

test("with no Twitch rows and nothing stored, the bundled template is used", async ({ context, session, worker }) => {
  await worker.evaluate(() => chrome.storage.local.remove("rowTemplate"));
  await seedChannels(worker, [channel("nonative_live", "NoNative_Live", { isLive: true, game: "G", viewers: 3 })]);
  await twitchDown(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("a[data-a-id^=followed-channel]").forEach((a) => a.remove()));
  });
  await page.goto("https://www.twitch.tv/");
  await page.locator("#__root").waitFor();
  await openGroup(page);
  await expect(rowFor(page, "nonative_live").locator("[data-a-target=side-nav-title]")).toHaveText("NoNative_Live");
  await expect(rowFor(page, "nonative_live")).toContainText("3 viewers");
});

test("a shared-stream row keeps its '+1' name and gets the game on the game line", async ({ context, session, worker, openTwitch }) => {
  await seedChannels(worker, [
    channel("fixtureshared", "FixtureShared", { isLive: true, game: "Another Game", viewers: 2500 }),
    channel("fixturesharedstreak", "FixtureSharedStreak", { isLive: true, game: "Third Game", viewers: 40 }),
  ]);
  await twitchDown(context);
  const page = await openTwitch();
  await openGroup(page);

  for (const [login, game, viewers] of [["fixtureshared", "Another Game", "2.5K"], ["fixturesharedstreak", "Third Game", "40"]]) {
    const row = rowFor(page, login);
    // The name block is untouched: the channel name, then " +1"
    const names = await row.locator("[data-a-target=side-nav-card-metadata] > div:first-child p").allTextContents();
    expect(names.slice(0, 2).map((n) => n.trim())).toEqual([expect.stringMatching(/^Fixture/), "+1"]);
    // The game is on the game line, and nowhere in the name block
    expect(names.join(" ")).not.toContain(game);
    await expect(row.locator("p[dir=auto]")).toHaveText(game);
    await expect(row).toContainText(`${viewers} viewers`);
  }
  await expect(rowFor(page, "fixturesharedstreak")).toContainText("Watch Streak");
});

test("live channels are listed by viewer count, highest first, with offline channels after", async ({ twitchPage }) => {
  await openGroup(twitchPage);
  // Twitch's follow order is fixture_live, fixturestreak, fixture_offline; viewers are 1,100 and 4,900
  const order = await twitchPage.locator("#__root a.side-nav-card__link").evaluateAll((rows) => rows.map((r) => r.getAttribute("href")));
  expect(order).toEqual(["/fixturestreak", "/fixture_live", "/fixture_offline"]);
});
