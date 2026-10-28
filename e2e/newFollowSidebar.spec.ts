import { test, expect, labelIn } from "./extension";
import type { BrowserContext, Page } from "@playwright/test";

// The viewer follows a channel on its page. Twitch's followed list either has it straight away or
// catches up a few seconds later; the sidebar must show it either way, and only once.

const AVATAR = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const json = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify(data) });

const STANDARD = [
  { id: "1", login: "fixture_live", display_name: "Fixture_Live" },
  { id: "2", login: "fixturestreak", display_name: "FixtureStreak" },
  { id: "3", login: "fixture_offline", display_name: "fixture_offline" },
];
const NEW_CHAN = { id: "50", login: "newchan", display_name: "NewChan" };

type State = { listed: boolean; followedCalls: number; lookups: number; unfollowed?: boolean };

// Layers a stub on top of the standard one: NewChan is in the followed list only once state.listed is true
const stubNewChan = async (context: BrowserContext, state: State) => {
  await context.route("https://api.twitch.tv/helix/**", (route) => {
    const url = new URL(route.request().url());
    const base = state.unfollowed ? STANDARD.filter((c) => c.login !== "fixture_live") : STANDARD;
    const people = state.listed ? [NEW_CHAN, ...base] : base;
    if (url.pathname === "/helix/channels/followed") {
      state.followedCalls++;
      return route.fulfill(
        json({
          total: people.length,
          data: people.map((c) => ({ broadcaster_id: c.id, broadcaster_login: c.login, broadcaster_name: c.display_name, followed_at: "2026-01-01T00:00:00Z" })),
          pagination: {},
        })
      );
    }
    if (url.pathname === "/helix/users") {
      if (url.searchParams.get("login") === "newchan") {
        state.lookups++;
        return route.fulfill(json({ data: [{ ...NEW_CHAN, profile_image_url: AVATAR }] }));
      }
      const ids = url.searchParams.getAll("id");
      if (ids.includes("50")) return route.fulfill(json({ data: [NEW_CHAN, ...STANDARD].filter((p) => ids.includes(p.id)).map((p) => ({ ...p, profile_image_url: AVATAR })) }));
    }
    return route.fallback();
  });
};

const openChannelPage = async (context: BrowserContext): Promise<Page> => {
  const page = await context.newPage();
  await page.goto("https://www.twitch.tv/newchan");
  await page.locator("#__root").waitFor();
  // Wait for the sidebar to have its channels before following
  await expect(page.locator('#__root a.side-nav-card__link[href="/fixture_live"]')).toBeVisible({ timeout: 10_000 });
  return page;
};

const rows = (page: Page) => page.locator('#__root a.side-nav-card__link[href="/newchan"]');
const pending = (worker: import("@playwright/test").Worker) => worker.evaluate(async () => (await chrome.storage.local.get("pendingFollows")).pendingFollows ?? null);

test("a follow that Twitch's list already has shows in the sidebar, with nothing pending", async ({ context, session, worker }) => {
  const state: State = { listed: false, followedCalls: 0, lookups: 0 };
  await stubNewChan(context, state);
  const page = await openChannelPage(context);
  await expect(rows(page)).toHaveCount(0);

  state.listed = true; // Twitch has recorded the follow by the time we ask
  await page.locator('[data-a-target="follow-button"]').click();
  await expect(rows(page)).toHaveCount(1, { timeout: 10_000 });
  expect(await pending(worker)).toBeNull();
  expect(state.lookups).toBe(0);
});

test("a follow that Twitch's list lags on shows at once as pending, then settles without a duplicate", async ({ context, session, worker }) => {
  const state: State = { listed: false, followedCalls: 0, lookups: 0 };
  await stubNewChan(context, state);
  const page = await openChannelPage(context);

  await page.locator('[data-a-target="follow-button"]').click();
  // The list does not have it, so the channel comes from the direct lookup
  await expect(rows(page)).toHaveCount(1, { timeout: 10_000 });
  expect(await pending(worker)).toMatchObject({ user: { id: "999" }, items: [{ channel: { login: "newchan", id: "50" } }] });
  expect(state.lookups).toBe(1);

  // Twitch catches up; the next retry picks it up and the pending entry goes away
  state.listed = true;
  await expect.poll(() => pending(worker), { timeout: 20_000 }).toBeNull();
  await expect(rows(page)).toHaveCount(1);
});

test("a pending channel is in the default group, and in the Manage Groups dialog", async ({ context, session }) => {
  const state: State = { listed: false, followedCalls: 0, lookups: 0 };
  await stubNewChan(context, state);
  const page = await openChannelPage(context);
  await page.locator('[data-a-target="follow-button"]').click();
  await expect(rows(page)).toHaveCount(1, { timeout: 10_000 });

  await page.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("channel-name").filter({ hasText: "NewChan" })).toHaveCount(1);
});

const liveRow = (page: Page) => page.locator('#__root a.side-nav-card__link[href="/fixture_live"]');

test("unfollowing a channel takes it out of the sidebar", async ({ context, session }) => {
  const state: State = { listed: false, followedCalls: 0, lookups: 0 };
  await stubNewChan(context, state);
  const page = await context.newPage();
  await page.goto("https://www.twitch.tv/fixture_live");
  await expect(liveRow(page)).toHaveCount(1, { timeout: 10_000 });

  state.unfollowed = true;
  await page.locator('[data-a-target="unfollow-button"]').click();
  await page.getByRole("button", { name: "Yes, unfollow" }).click();
  await expect(liveRow(page)).toHaveCount(0, { timeout: 10_000 });
});

test("opening the Unfollow confirmation and cancelling leaves the channel in the sidebar", async ({ context, session, worker }) => {
  const state: State = { listed: false, followedCalls: 0, lookups: 0 };
  await stubNewChan(context, state);
  const page = await context.newPage();
  await page.goto("https://www.twitch.tv/fixture_live");
  await expect(liveRow(page)).toHaveCount(1, { timeout: 10_000 });

  await page.locator('[data-a-target="unfollow-button"]').click();
  await page.waitForTimeout(500);
  expect(await pending(worker)).toBeNull(); // nothing is hidden before the user confirms
  await expect(liveRow(page)).toHaveCount(1);
  await page.getByRole("button", { name: "No, cancel" }).click();
  await page.waitForTimeout(2_500);
  expect(await pending(worker)).toBeNull();
  await expect(liveRow(page)).toHaveCount(1);
});

test("an unfollow that Twitch's list lags on is hidden at once, stays hidden, and is cleared once the list drops it", async ({ context, session, worker }) => {
  const state: State = { listed: false, followedCalls: 0, lookups: 0 };
  await stubNewChan(context, state);
  const page = await context.newPage();
  await page.goto("https://www.twitch.tv/fixture_live");
  await expect(liveRow(page)).toHaveCount(1, { timeout: 10_000 });

  await page.locator('[data-a-target="unfollow-button"]').click();
  await page.getByRole("button", { name: "Yes, unfollow" }).click(); // the list still has it
  await expect(liveRow(page)).toHaveCount(0, { timeout: 5_000 });
  await page.waitForTimeout(2_500); // the fresh list came back with it: still hidden
  await expect(liveRow(page)).toHaveCount(0);
  expect(await pending(worker)).toMatchObject({ removed: [{ login: "fixture_live" }] });

  state.unfollowed = true; // Twitch catches up; the next retry sees it gone
  await expect.poll(() => pending(worker), { timeout: 20_000 }).toBeNull();
  await expect(liveRow(page)).toHaveCount(0);
});

// Twitch's button labels are translated ("Seguir a NewChan"); the extension must not depend on them
for (const language of ["es", "xx"] as const) {
  test.describe(`with Twitch in ${language === "es" ? "Spanish" : "a made-up language"}`, () => {
    test.use({ twitchLanguage: language });

    test("a follow shows in the sidebar", async ({ context, session, worker }) => {
      const state: State = { listed: false, followedCalls: 0, lookups: 0 };
      await stubNewChan(context, state);
      const page = await openChannelPage(context);
      await expect(page.locator('[data-a-target="follow-button"]').first()).toHaveAttribute("aria-label", labelIn(language, "Follow NewChan"));
      await expect(rows(page)).toHaveCount(0);

      state.listed = true;
      await page.locator('[data-a-target="follow-button"]').first().click();
      await expect(rows(page)).toHaveCount(1, { timeout: 10_000 });
      expect(await pending(worker)).toBeNull();
    });

    test("a follow the list lags on still shows, as pending", async ({ context, session, worker }) => {
      const state: State = { listed: false, followedCalls: 0, lookups: 0 };
      await stubNewChan(context, state);
      const page = await openChannelPage(context);
      await page.locator('[data-a-target="follow-button"]').first().click();
      await expect(rows(page)).toHaveCount(1, { timeout: 10_000 });
      expect(await pending(worker)).toMatchObject({ items: [{ channel: { login: "newchan" } }] });
    });

    test("an unfollow takes the channel out of the sidebar", async ({ context, session }) => {
      const state: State = { listed: false, followedCalls: 0, lookups: 0 };
      await stubNewChan(context, state);
      const page = await context.newPage();
      await page.goto("https://www.twitch.tv/fixture_live");
      await expect(liveRow(page)).toHaveCount(1, { timeout: 10_000 });

      state.unfollowed = true;
      await page.locator('[data-a-target="unfollow-button"]').first().click();
      await page.getByRole("button", { name: "Yes, unfollow" }).click();
      await expect(liveRow(page)).toHaveCount(0, { timeout: 10_000 });
    });
  });
}
