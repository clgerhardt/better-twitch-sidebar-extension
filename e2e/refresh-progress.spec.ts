import { test, expect } from "./extension";
import type { BrowserContext, Page } from "@playwright/test";

const seedSnapshot = (worker: any, ageMs: number) =>
  worker.evaluate(async (age: number) => {
    const now = Date.now();
    await chrome.storage.local.set({
      channelSnapshot: {
        version: 1,
        user: { id: "999" },
        fetchedAt: now - age,
        staticAt: now,
        channels: [{ id: "1", login: "fixture_live", displayName: "Fixture_Live", image: "", isLive: true, game: "Lootbound", viewers: 1100 }],
      },
    });
  }, ageMs);

// How full the bar is, from 0 to 1, measured from what is on screen
const fill = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector("[data-testid=refresh-progress]") as HTMLElement | null;
    const bar = track?.firstElementChild as HTMLElement | null;
    if (!track || !bar) return null;
    return bar.getBoundingClientRect().width / track.getBoundingClientRect().width;
  });

// Twitch is unreachable, so the stored data stays as old as it was seeded
const twitchDown = (context: BrowserContext) => context.route("https://api.twitch.tv/helix/**", (route) => route.fulfill({ status: 500, body: "{}" }));

test("the bar shows how old the stored data is", async ({ context, session, worker, openTwitch }) => {
  await seedSnapshot(worker, 30_000);
  await twitchDown(context);
  const page = await openTwitch();
  await expect(page.getByTestId("refresh-progress")).toBeVisible();
  const half = (await fill(page))!;
  expect(half).toBeGreaterThan(0.45);
  expect(half).toBeLessThan(0.65);
});

test("the bar stays full while refreshes keep failing", async ({ context, session, worker, openTwitch }) => {
  await seedSnapshot(worker, 90_000);
  await twitchDown(context);
  const page = await openTwitch();
  await expect(page.getByTestId("refresh-progress")).toBeVisible();
  expect(await fill(page)).toBeGreaterThan(0.99);
});

test("the bar restarts when fresh data arrives", async ({ context, session, worker, openTwitch }) => {
  const page = await openTwitch();
  await expect.poll(() => fill(page)).not.toBeNull();

  // The stored data becomes 45 seconds old: the bar jumps to three quarters
  await seedSnapshot(worker, 45_000);
  await expect.poll(() => fill(page)).toBeGreaterThan(0.65);

  // The user comes back to the tab, a refresh lands: the bar starts over
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => fill(page), { timeout: 8_000 }).toBeLessThan(0.2);
});

test("there is no bar when logged out", async ({ session, worker, openTwitch, context, extensionId }) => {
  const page = await openTwitch();
  await expect(page.getByTestId("refresh-progress")).toBeVisible();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();
  await expect(page.getByTestId("refresh-progress")).toHaveCount(0);
});

test("the bar keeps clear of the Stories section above it", async ({ twitchPage }) => {
  await expect(twitchPage.getByTestId("refresh-progress")).toBeVisible();
  const gap = await twitchPage.evaluate(() => {
    const stories = document.querySelector("[class*='storiesLeftNavSection']")!.getBoundingClientRect();
    const bar = document.querySelector("[data-testid=refresh-progress]")!.getBoundingClientRect();
    return bar.top - stories.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(8);
});
