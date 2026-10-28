import { test as base, chromium, expect, BrowserContext, Page, Worker } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXTENSION_PATH = path.resolve("dist_chrome");
const SIDEBAR_FIXTURE = fs.readFileSync(path.resolve("e2e/fixtures/twitch-sidebar.html"), "utf8");

// Fake Twitch accounts served by the stubbed Helix API. Logins match the row fixtures.
const CHANNELS = [
  { id: "1", login: "fixture_live", display_name: "Fixture_Live", game: "Lootbound", title: "Fixture live stream title", viewers: 1100 },
  { id: "2", login: "fixturestreak", display_name: "FixtureStreak", game: "Escape from Tarkov", title: "Fixture streak stream title", viewers: 4900 },
  { id: "3", login: "fixture_offline", display_name: "fixture_offline", game: null, title: "", viewers: 0 },
];

// A 1x1 image as a data URI, so avatars need no network
const AVATAR = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const json = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify(data) });

// Twitch translates its labels; the markup around them stays the same. "es" uses the Spanish labels Twitch
// really shows (read off twitch.tv with its language set to es-ES). "xx" is a made-up language, so nothing
// can depend on any one real language: every label becomes accented look-alike letters in brackets.
export type TwitchLanguage = "en" | "es" | "xx";

const SPANISH_LABELS: Record<string, string> = {
  "Followed Channels": "Canales que sigo",
  "Live Channels": "Canales en directo",
  "Recommended Categories": "Categorías recomendadas",
  "FixtureChannel Viewers Also Watch": "Los espectadores de FixtureChannel también ven",
  "Watch Streaks at risk": "Rachas de visualizaciones en riesgo",
  "Collapse Side Nav": "Contraer navegación lateral",
  "Follow NewChan": "Seguir a NewChan",
  "Unfollow Fixture_Live": "Dejar de seguir a Fixture_Live",
  "Watch Streak": "Racha de visualizaciones", // after "Watch Streaks at risk", which it is a prefix of
};
const LABELS = Object.keys(SPANISH_LABELS);

const pseudo = (text: string) => "[" + text.replace(/[A-Za-z]/g, (c) => ({ a: "å", e: "é", i: "ï", o: "ø", u: "ü", n: "ñ", c: "ç", s: "š", t: "ţ", l: "ł" } as Record<string, string>)[c.toLowerCase()] ?? c) + "]";

// What Twitch calls this label in that language
export const labelIn = (language: TwitchLanguage, english: string): string =>
  language === "en" ? english : language === "es" ? SPANISH_LABELS[english] ?? english : pseudo(english);

const fixtureIn = (language: TwitchLanguage) =>
  language === "en"
    ? SIDEBAR_FIXTURE
    : LABELS.reduce((html, label) => html.split(label).join(labelIn(language, label)), SIDEBAR_FIXTURE).replace(/<html lang="en">/, `<html lang="${language === "es" ? "es-ES" : "xx"}">`);

async function stubTwitch(context: BrowserContext, language: TwitchLanguage) {
  const fixture = fixtureIn(language);
  await context.route("https://www.twitch.tv/**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === "document") {
      return route.fulfill({ contentType: "text/html", body: fixture });
    }
    return route.fulfill({ status: 204, body: "", headers: { "x-fixture": url.pathname } });
  });

  // Twitch says the token belongs to the fake viewer and lasts weeks (tests override this per case)
  await context.route("https://id.twitch.tv/oauth2/validate", (route) => route.fulfill(json({ user_id: "999", login: "fixture_viewer", expires_in: 5_000_000 })));

  await context.route("https://api.twitch.tv/helix/**", (route) => {
    const url = new URL(route.request().url());
    switch (url.pathname) {
      case "/helix/channels/followed":
        return route.fulfill(
          json({
            total: CHANNELS.length,
            data: CHANNELS.map((c) => ({ broadcaster_id: c.id, broadcaster_login: c.login, broadcaster_name: c.display_name, followed_at: "2026-01-01T00:00:00Z" })),
            pagination: {},
          })
        );
      case "/helix/users": {
        const ids = url.searchParams.getAll("id");
        if (ids.length === 0) {
          return route.fulfill(json({ data: [{ id: "999", login: "fixture_viewer", display_name: "Fixture_Viewer", profile_image_url: "" }] }));
        }
        const people = [...CHANNELS.map((c) => ({ id: c.id, login: c.login, display_name: c.display_name })), { id: "999", login: "fixture_viewer", display_name: "Fixture_Viewer" }];
        return route.fulfill(json({ data: people.filter((p) => ids.includes(p.id)).map((p) => ({ ...p, profile_image_url: AVATAR })) }));
      }
      case "/helix/streams/followed":
        return route.fulfill(
          json({
            data: CHANNELS.filter((c) => c.viewers > 0).map((c) => ({ user_id: c.id, user_login: c.login, user_name: c.display_name, game_name: c.game, title: c.title, viewer_count: c.viewers, type: "live" })),
            pagination: {},
          })
        );
      default:
        return route.fulfill(json({ data: [] }));
    }
  });
}

type Options = {
  // Drops the Stories section from the fixture, as on accounts/pages without one
  removeStories: boolean;
  // The language Twitch is shown in: its labels are translated, the markup around them is not
  twitchLanguage: TwitchLanguage;
};

type Fixtures = {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  // Logs the extension in (fake token and user) without opening a page
  session: void;
  // Opens a Twitch tab and waits for the extension's UI to mount
  openTwitch: () => Promise<Page>;
  twitchPage: Page;
};

export const test = base.extend<Fixtures & Options>({
  removeStories: [false, { option: true }],
  twitchLanguage: ["en", { option: true }],

  context: async ({ removeStories, twitchLanguage }, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "btse-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await stubTwitch(context, twitchLanguage);
    // The browser is signed in to the same fake Twitch account the extension is connected as
    await context.addCookies([
      { name: "twilight-user", value: encodeURIComponent(JSON.stringify({ id: "999", login: "fixture_viewer", displayName: "Fixture_Viewer" })), url: "https://www.twitch.tv/" },
    ]);
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

  // A seeded, logged-in extension state. onInstalled resets storage asynchronously, so wait for
  // its default globalState before overwriting.
  session: async ({ worker }, use) => {
    await expect
      .poll(() => worker.evaluate(async () => !!(await chrome.storage.local.get("globalState")).globalState), { timeout: 15_000 })
      .toBe(true);
    await worker.evaluate(async () => {
      const { globalState } = await chrome.storage.local.get("globalState");
      await chrome.storage.local.set({
        twitchToken: "fixture-token",
        tokenExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        twitchUserId: "999",
        twitchUserImage: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        globalState: { ...globalState, loggedIn: true },
      });
    });
    await use();
  },

  openTwitch: async ({ context, session }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto("https://www.twitch.tv/");
      // The content script mounts #__root once it is listening for messages
      await page.locator("#__root").waitFor();
      return page;
    });
  },

  twitchPage: async ({ openTwitch }, use) => {
    await use(await openTwitch());
  },
});

export { expect };
