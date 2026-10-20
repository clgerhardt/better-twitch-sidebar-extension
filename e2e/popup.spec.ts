import { test, expect } from "./extension";
import type { Page } from "@playwright/test";

const PICTURE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const openPopup = async (page: Page, extensionId: string) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://api.twitch.tv/")) requests.push(request.url());
  });
  await page.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  return requests;
};

test.describe("the connected popup", () => {
  test.beforeEach(async ({ twitchPage, worker }) => {
    await worker.evaluate((picture) => chrome.storage.local.set({ twitchUserImage: picture }), PICTURE);
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("pageAccount")).pageAccount?.status)).toBe("signed_in");
  });

  test("shows the name and picture without asking Twitch for them", async ({ context, extensionId }) => {
    const popup = await context.newPage();
    const requests = await openPopup(popup, extensionId);
    await expect(popup.getByText("Fixture_Viewer")).toBeVisible();
    await expect(popup.getByRole("img", { name: "Fixture_Viewer" })).toBeVisible();
    await popup.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test("never shows a broken picture or its alt text", async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await openPopup(popup, extensionId);
    await expect(popup.getByText("Fixture_Viewer")).toBeVisible();
    await expect(popup.getByText("User Avatar")).toHaveCount(0);
    const loaded = await popup.locator("img[alt='Fixture_Viewer']").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test("the toggles do not move while the page settles, even with a slow Twitch", async ({ context, extensionId }) => {
    await context.route("https://api.twitch.tv/helix/users*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.fallback();
    });
    const popup = await context.newPage();
    await openPopup(popup, extensionId);
    const toggle = popup.getByRole("switch").first();
    await expect(toggle).toBeVisible();
    const early = (await toggle.boundingBox())!.y;
    await popup.waitForTimeout(1_600);
    expect((await toggle.boundingBox())!.y).toBe(early);
  });

  test("a session saved without a picture gets it from the background and the popup shows it", async ({ context, worker, extensionId }) => {
    await worker.evaluate(() => chrome.storage.local.remove("twitchUserImage"));
    const popup = await context.newPage();
    await openPopup(popup, extensionId);
    await expect(popup.getByTestId("avatar-initial")).toHaveText("F");

    // The next refresh saves the picture, and the open popup picks it up
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: "REFRESH_CHANNELS", force: true }));
    await expect.poll(() => worker.evaluate(async () => !!(await chrome.storage.local.get("twitchUserImage")).twitchUserImage)).toBe(true);
    await expect(popup.getByRole("img", { name: "Fixture_Viewer" })).toBeAttached();
  });

  test("a picture that is not stored yet shows the account's initial in a circle", async ({ context, worker, extensionId }) => {
    await worker.evaluate(() => chrome.storage.local.remove("twitchUserImage"));
    const popup = await context.newPage();
    await openPopup(popup, extensionId);
    await expect(popup.getByText("Fixture_Viewer")).toBeVisible();
    await expect(popup.getByTestId("avatar-initial")).toHaveText("F");
    await expect(popup.getByText("User Avatar")).toHaveCount(0);
  });
});

test.describe("the popup's look", () => {
  const goto = async (page: Page, extensionId: string) => page.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);

  test("has a slim banner that says Better Sidebar, never Twitch, and no baked-in image", async ({ twitchPage, context, extensionId }) => {
    const popup = await context.newPage();
    await goto(popup, extensionId);
    const banner = popup.getByTestId("popup-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/better sidebar/i);
    await expect(banner).toContainText(/group your way/i);
    await expect(banner).not.toContainText(/twitch/i);
    expect((await banner.boundingBox())!.height).toBeLessThanOrEqual(80);
    await expect(popup.locator("img[src*='cover']")).toHaveCount(0);
  });

  test("is a dark 320px panel", async ({ twitchPage, context, extensionId }) => {
    const popup = await context.newPage();
    await goto(popup, extensionId);
    await expect(popup.getByTestId("popup-banner")).toBeVisible();
    const m = await popup.evaluate(() => ({ background: getComputedStyle(document.body).backgroundColor, width: document.body.getBoundingClientRect().width }));
    expect(m).toEqual({ background: "rgb(24, 24, 27)", width: 320 });
  });

  test("lists the toggles as dark rows with switches, not white cards", async ({ twitchPage, context, extensionId }) => {
    const popup = await context.newPage();
    await goto(popup, extensionId);
    await expect(popup.getByRole("switch")).toHaveCount(6);
    await expect(popup.getByText("Hide original followers list")).toBeVisible();
    const whites = await popup.evaluate(() => [...document.querySelectorAll("#main-container *")].filter((el) => getComputedStyle(el).backgroundColor === "rgb(255, 255, 255)" && el.getBoundingClientRect().width > 40).length);
    expect(whites).toBe(0);
  });

  test("Logout sits right under the toggles, with no empty gap", async ({ twitchPage, context, extensionId }) => {
    const popup = await context.newPage();
    await goto(popup, extensionId);
    await expect(popup.getByRole("switch")).toHaveCount(6);
    const gap = await popup.evaluate(() => {
      const last = [...document.querySelectorAll("[role=switch]")].pop()!.closest("div")!.getBoundingClientRect();
      const logout = [...document.querySelectorAll("button")].find((b) => b.innerText === "Logout")!.getBoundingClientRect();
      return logout.top - last.bottom;
    });
    expect(gap).toBeLessThanOrEqual(20);
  });

  test("Logout is a quiet purple outline, not a big red button", async ({ twitchPage, context, extensionId }) => {
    const popup = await context.newPage();
    await goto(popup, extensionId);
    const logout = popup.getByRole("button", { name: "Logout" });
    const m = await logout.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` };
    });
    expect(m).toEqual({ background: "rgba(0, 0, 0, 0)", border: "2px solid rgb(168, 85, 247)" });
  });

  test("every popup screen has the same banner", async ({ twitchPage, context, worker, extensionId }) => {
    const popup = await context.newPage();
    // signed out of Twitch
    await worker.evaluate(() => chrome.storage.local.set({ pageAccount: { status: "signed_out", seenAt: Date.now() } }));
    await goto(popup, extensionId);
    await expect(popup.getByTestId("popup-banner")).toBeVisible();
    await expect(popup.getByText("signed out of Twitch")).toBeVisible();

    // not connected
    await worker.evaluate(() => chrome.storage.local.set({ pageAccount: { status: "signed_in", id: "999", login: "fixture_viewer", displayName: "Fixture_Viewer", seenAt: Date.now() } }));
    await popup.getByRole("button", { name: "Logout" }).click();
    await expect(popup.getByRole("button", { name: /^Connect for/ })).toBeVisible();
    await expect(popup.getByTestId("popup-banner")).toBeVisible();
    await expect(popup.locator("img[src*='cover']")).toHaveCount(0);
  });
});

test.describe("the popup when the extension is not connected", () => {
  test("shows the connect view and never connects on its own, even if Twitch would approve silently", async ({ session, context, worker, extensionId, openTwitch }) => {
    await worker.evaluate(async () => {
      await chrome.storage.local.remove(["twitchToken", "twitchUserId", "twitchUserImage", "tokenExpiresAt", "channelSnapshot"]);
    });
    await openTwitch();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("pageAccount")).pageAccount?.status)).toBe("signed_in");

    const popup = await context.newPage();
    // Twitch would hand a token to a silent sign-in, as it does for a browser already signed in
    await popup.addInitScript(() => {
      (chrome.identity as any).launchWebAuthFlow = (_o: unknown, cb: (url?: string) => void) =>
        cb("https://fixture.chromiumapp.org/#access_token=silent-token&scope=user%3Aread%3Afollows&token_type=bearer");
    });
    await openPopup(popup, extensionId);
    await expect(popup.getByRole("button", { name: "Connect for fixture_viewer" })).toBeVisible();
    await expect(popup.getByText("Connected", { exact: true })).toHaveCount(0);
    await popup.waitForTimeout(500);
    expect((await worker.evaluate(() => chrome.storage.local.get("twitchToken"))).twitchToken).toBeUndefined();
  });
});
