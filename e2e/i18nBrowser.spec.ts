import { test, expect } from "./extension";
import type { BrowserContext, Locator, Page, Worker } from "@playwright/test";

// Twitch changes the page's language without a reload; the extension follows it (and the popup, which is not
// on a Twitch page, follows the last language a page was seen in)
const speak = async (worker: Worker, page: Page, language: string) => {
  await page.evaluate((value) => document.documentElement.setAttribute("lang", value), language);
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("twitchLanguage")).twitchLanguage)).toBe(language);
};

const openPopup = async (context: BrowserContext, extensionId: string) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  return popup;
};

const manageButton = (page: Page, name: string) => page.locator("#__manage-groups-root").getByRole("button", { name });
const headers = (page: Page) => page.locator("#__root [data-accordion-component=AccordionItemButton]");

test.describe("Twitch in Spanish", () => {
  test.use({ twitchLanguage: "es" });

  test("the sidebar, the dialog and the popup are in Spanish, and so is the built-in default group's name", async ({ twitchPage, context, extensionId }) => {
    await expect(manageButton(twitchPage, "Gestionar grupos")).toBeVisible({ timeout: 8_000 });
    await expect(headers(twitchPage).first()).toContainText("Sin grupo");
    await expect(headers(twitchPage).first()).toHaveAttribute("title", /en directo de/);

    await manageButton(twitchPage, "Gestionar grupos").click();
    const dialog = twitchPage.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Gestionar grupos" })).toBeVisible();
    await expect(dialog.getByRole("list", { name: "Grupos" })).toContainText("Sin grupo");
    await expect(dialog.getByRole("list", { name: "Grupos" })).toContainText("Predeterminado");
    await dialog.getByPlaceholder("Añadir grupo").fill("ab");
    await expect(dialog).toContainText("El nombre del grupo debe tener al menos 3 caracteres");
    await expect(dialog.getByRole("button", { name: "Añadir", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Mover Sin grupo hacia abajo" })).toBeVisible();

    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await expect(popup.getByRole("button", { name: /Ocultar secciones/ })).toBeVisible();
    await expect(popup.getByText("Conectado")).toBeVisible();
    await expect(popup.getByTestId("sync-status")).toContainText("Los grupos se sincronizan entre tus dispositivos");
  });

  test("follows Twitch when it changes language, with no reload, and the popup has no language setting of its own", async ({ twitchPage, worker, context, extensionId }) => {
    await expect(manageButton(twitchPage, "Gestionar grupos")).toBeVisible({ timeout: 8_000 });
    await speak(worker, twitchPage, "en-US");
    await expect(manageButton(twitchPage, "Manage Groups")).toBeVisible({ timeout: 5_000 });
    await expect(headers(twitchPage).first()).toContainText("Ungrouped");
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole("button", { name: "Logout" })).toBeVisible();
    await expect(popup.locator("select")).toHaveCount(0);
  });
});

test.describe("Twitch in English", () => {
  test("is English, and becomes Spanish when Twitch does", async ({ twitchPage, worker, context, extensionId }) => {
    await expect(manageButton(twitchPage, "Manage Groups")).toBeVisible();
    await speak(worker, twitchPage, "es-ES");
    await expect(manageButton(twitchPage, "Gestionar grupos")).toBeVisible({ timeout: 5_000 });
    await expect(headers(twitchPage).first()).toContainText("Sin grupo");
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("the popup follows the language Twitch was last seen in, then Chrome's", async ({ twitchPage, worker, context, extensionId }) => {
    await worker.evaluate(() => chrome.storage.local.set({ twitchLanguage: "es-ES" }));
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });
});

// Rows the extension builds itself (Twitch rendered none for them) carry our text
const seedChannels = (worker: Worker, channels: object[]) =>
  worker.evaluate(async (list) => {
    const now = Date.now();
    await chrome.storage.local.set({ channelSnapshot: { version: 1, user: { id: "999" }, fetchedAt: now, staticAt: now, channels: list } });
  }, channels);
const channel = (login: string, displayName: string, over: Record<string, unknown> = {}) => ({ id: login, login, displayName, image: "", isLive: false, game: "", viewers: 0, ...over });
const twitchDown = (context: BrowserContext) => context.route("https://api.twitch.tv/helix/**", (route) => route.fulfill({ status: 500, body: "{}" }));

test.describe("rows built by the extension", () => {
  const rowText = async (page: Page, login: string) => (await page.locator(`#__root a.side-nav-card__link[href="/${login}"]`).innerText()).replace(/\s+/g, " ");

  for (const [language, viewers, offline, live] of [
    ["en", "7 viewers", "Offline", "Live"],
    ["es", "7 espectadores", "Sin conexión", "En directo"],
  ] as const) {
    test.describe(language, () => {
    test.use({ twitchLanguage: language });
    test(`say how many viewers, that a channel is offline, and that it is live, in ${language}`, async ({ context, session, worker, openTwitch }) => {
      await seedChannels(worker, [channel("nonative_live", "NoNative_Live", { isLive: true, game: "Template Game", viewers: 7 }), channel("nonative_off", "NoNative_Off")]);
      await twitchDown(context);
      const page = await openTwitch();
      await expect(page.locator('#__root a.side-nav-card__link[href="/nonative_live"]')).toBeVisible({ timeout: 8_000 });
      const liveRow = await rowText(page, "nonative_live");
      expect(liveRow).toContain(viewers);
      expect(liveRow).toContain(live);
      expect(await rowText(page, "nonative_off")).toContain(offline);
    });
    });
  }

  test("a single viewer is singular", async ({ context, session, worker, openTwitch }) => {
    await seedChannels(worker, [channel("solo_live", "Solo_Live", { isLive: true, game: "G", viewers: 1 })]);
    await twitchDown(context);
    const page = await openTwitch();
    await expect(page.locator('#__root a.side-nav-card__link[href="/solo_live"]')).toBeVisible({ timeout: 8_000 });
    expect(await rowText(page, "solo_live")).toContain("1 viewer");
    expect(await rowText(page, "solo_live")).not.toContain("1 viewers");
  });
});

const pseudo = (key: MessageKey) => translate(PSEUDO, undefined, key);

// Every message is wrapped in brackets in the pseudo-locale, so any text that is not is text that was never
// moved into the catalog. Names the user or Twitch supplies (channels, groups, accounts) are not ours.
const untranslated = (root: Locator) =>
  root.evaluate((el) => {
    const skip = '[data-testid="channel-name"], [data-testid="avatar-initial"], a.side-nav-card__link, option, [data-testid="popup-banner"] div:first-child';
    const allowed = [/^Fixture_/, /^Alpha$/, /^[\d.,\s]+$/, /^[—·]+$/];
    const found: string[] = [];
    const check = (text: string) => {
      const t = text.trim();
      if (t && /\p{L}/u.test(t) && !t.startsWith("[") && !allowed.some((re) => re.test(t))) found.push(t);
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement?.closest(skip)) check(n.textContent ?? "");
    for (const e of el.querySelectorAll("[aria-label], [title], [placeholder]")) {
      if (e.closest(skip)) continue;
      for (const a of ["aria-label", "title", "placeholder"]) {
        const v = e.getAttribute(a);
        if (v) check(v);
      }
    }
    return [...new Set(found)];
  });

test.describe("nothing is left out of the catalog", () => {
  test("the sidebar", async ({ twitchPage, worker }) => {
    await speak(worker, twitchPage, "qps");
    await expect(manageButton(twitchPage, /^\[.*\]$/)).toBeVisible({ timeout: 8_000 });
    expect(await untranslated(twitchPage.locator("#__root"))).toEqual([]);
    expect(await untranslated(twitchPage.locator("#__manage-groups-root"))).toEqual([]);
  });

  test("the Manage Groups dialog, with another group selected and an error showing", async ({ twitchPage, worker }) => {
    await speak(worker, twitchPage, "qps");
    await twitchPage.locator("#__manage-groups-root").getByRole("button").click();
    const dialog = twitchPage.getByRole("dialog");
    await expect(dialog.getByTestId("dialog-panel")).toBeVisible();
    expect(await untranslated(dialog)).toEqual([]); // the default group is selected

    // A group of the user's own, selected: it can be made the default, renamed, deleted and coloured
    await dialog.getByPlaceholder(/^\[/).first().fill("Alpha");
    await dialog.locator("form button[type=submit]").click();
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText("Alpha");
    await dialog.getByRole("button", { name: pseudo("dialog.renameGroup") }).click();
    expect(await untranslated(dialog)).toEqual([]);

    // An error message under the field
    await dialog.getByRole("button", { name: pseudo("dialog.cancelRename") }).click();
    await dialog.getByPlaceholder(/^\[/).first().fill("ab");
    await expect(dialog.getByTestId("dialog-panel")).toContainText("[");
    expect(await untranslated(dialog)).toEqual([]);
  });

  test("the sweep itself catches text that was not translated (in English the popup is full of it)", async ({ twitchPage, context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    const found = await untranslated(popup.locator("#main-container"));
    expect(found).toContain("Logout");
    expect(found).toContain("Hide sections");
  });

  test("the popup", async ({ twitchPage, worker, context, extensionId }) => {
    await speak(worker, twitchPage, "qps");
    const popup = await openPopup(context, extensionId);
    await popup.locator("[aria-controls=hide-sections]").click();
    await expect(popup.locator("[aria-controls=hide-sections]")).toHaveAttribute("aria-expanded", "true");
    expect(await untranslated(popup.locator("#main-container"))).toEqual([]);
  });
});

// Every language the extension offers: the sidebar, the dialog and the popup show its text, run in its
// direction, and nothing spills out of its box however long the words are
import { LANGUAGES, PSEUDO } from "../src/pages/shared/i18n/languages";
import { translate, type MessageKey } from "../src/pages/shared/i18n/i18n";
import type { Catalog } from "../src/pages/shared/i18n/catalog.en";

test.describe("every language", () => {
  for (const { code, dir } of LANGUAGES.filter((l) => l.code !== "en")) {
    test(`${code}: translated, ${dir}, and nothing overflows`, async ({ twitchPage, worker, context, extensionId }) => {
      const catalog: Catalog = (await import(`../src/pages/shared/i18n/catalogs/${code}`)).default;
      await speak(worker, twitchPage, code);

      await expect(manageButton(twitchPage, catalog["manage.button"] as string)).toBeVisible({ timeout: 8_000 });
      await expect(twitchPage.locator("#__root")).toHaveAttribute("dir", dir);
      await expect(headers(twitchPage).first()).toContainText(catalog["group.default.name"] as string);

      await manageButton(twitchPage, catalog["manage.button"] as string).click();
      const panel = twitchPage.getByTestId("dialog-panel");
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute("dir", dir);
      await expect(panel.getByRole("heading", { name: catalog["dialog.title"] as string })).toBeVisible();
      await panel.getByPlaceholder(catalog["dialog.addPlaceholder"] as string).fill("ab"); // an error message, the longest text there
      const overflow = await panel.evaluate((el) => [...el.querySelectorAll<HTMLElement>("*")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0).map((e) => e.tagName + ":" + (e.textContent ?? "").slice(0, 30)));
      expect(overflow).toEqual([]);

      const popup = await openPopup(context, extensionId);
      await expect(popup.getByRole("button", { name: catalog["popup.logout"] as string })).toBeVisible();
      await expect(popup.locator("html")).toHaveAttribute("dir", dir);
      await popup.getByRole("button", { name: new RegExp(`^${(catalog["popup.hideSections"] as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
      expect(await popup.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const popupOverflow = await popup.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0 && !e.closest("select")).map((e) => e.tagName + ":" + (e.textContent ?? "").slice(0, 30)));
      expect(popupOverflow).toEqual([]);
    });
  }
});
