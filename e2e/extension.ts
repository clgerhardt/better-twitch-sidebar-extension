import { test as base, chromium, expect, BrowserContext, Page, Worker } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXTENSION_PATH = path.resolve("dist_chrome");
const SIDEBAR_FIXTURE = fs.readFileSync(path.resolve("e2e/fixtures/twitch-sidebar.html"), "utf8");

// Fake Twitch accounts served by the stubbed Helix API. Logins match the row fixtures.
const CHANNELS = [
  { id: "1", login: "fixture_live", display_name: "Fixture_Live", game: "Lootbound", viewers: 1100 },
  { id: "2", login: "fixturestreak", display_name: "FixtureStreak", game: "Escape from Tarkov", viewers: 4900 },
  { id: "3", login: "fixture_offline", display_name: "fixture_offline", game: null, viewers: 0 },
];

const json = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify(data) });

async function stubTwitch(context: BrowserContext) {
  await context.route("https://www.twitch.tv/**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === "document") {
      return route.fulfill({ contentType: "text/html", body: SIDEBAR_FIXTURE });
    }
    return route.fulfill({ status: 204, body: "", headers: { "x-fixture": url.pathname } });
  });

  await context.route("https://api.twitch.tv/helix/**", (route) => {
    const url = new URL(route.request().url());
    switch (url.pathname) {
      case "/helix/channels/followed":
        return route.fulfill(json({ data: CHANNELS.map((c) => ({ broadcaster_id: c.id })), pagination: {} }));
      case "/helix/users": {
        const ids = url.searchParams.getAll("id");
        if (ids.length === 0) {
          return route.fulfill(json({ data: [{ id: "999", login: "fixture_viewer", display_name: "Fixture_Viewer", profile_image_url: "" }] }));
        }
        return route.fulfill(json({ data: CHANNELS.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, login: c.login, display_name: c.display_name, profile_image_url: "" })) }));
      }
      case "/helix/streams": {
        const ids = url.searchParams.getAll("user_id");
        return route.fulfill(json({ data: CHANNELS.filter((c) => c.viewers > 0 && ids.includes(c.id)).map((c) => ({ user_id: c.id, game_name: c.game, viewer_count: c.viewers })) }));
      }
      default:
        return route.fulfill(json({ data: [] }));
    }
  });
}

type Options = {
  // Drops the Stories section from the fixture, as on accounts/pages without one
  removeStories: boolean;
};

type Fixtures = {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  twitchPage: Page;
};

export const test = base.extend<Fixtures & Options>({
  removeStories: [false, { option: true }],

  context: async ({ removeStories }, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "btse-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await stubTwitch(context);
    if (removeStories) {
      await context.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          document.querySelector("[class*='storiesLeftNavSection']")?.remove();
        });
      });
    }
    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },

  // A Twitch tab with a seeded, logged-in extension state. onInstalled resets storage
  // asynchronously, so wait for its default globalState before overwriting.
  twitchPage: async ({ context, worker }, use) => {
    await expect
      .poll(() => worker.evaluate(async () => !!(await chrome.storage.local.get("globalState")).globalState))
      .toBe(true);
    await worker.evaluate(async () => {
      const { globalState } = await chrome.storage.local.get("globalState");
      await chrome.storage.local.set({
        twitchToken: "fixture-token",
        tokenIssuedAt: Date.now(),
        twitchUserId: "999",
        globalState: { ...globalState, loggedIn: true },
      });
    });
    const page = await context.newPage();
    await page.goto("https://www.twitch.tv/");
    // The content script mounts #__root once it is listening for messages
    await page.locator("#__root").waitFor();
    await use(page);
  },
});

export { expect };
