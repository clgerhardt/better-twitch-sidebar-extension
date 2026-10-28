import { test, expect, labelIn, type TwitchLanguage } from "./extension";
import { translate, type MessageKey } from "../src/pages/shared/i18n/i18n";
import es from "../src/pages/shared/i18n/catalogs/es";
import type { Page } from "@playwright/test";

// Twitch shown in another language: its section labels are translated, the markup around them is not. The
// extension finds Twitch's sections by that markup, so it must work the same in every language. Checked
// against Spanish (the labels Twitch really shows) and a made-up language, so that nothing can depend on
// any one language's text. Our own text follows Twitch's language where we have it (Spanish) and is
// English otherwise.
// Our own text in the language the extension ends up showing for that Twitch language
const ui = (language: TwitchLanguage) => (key: MessageKey, params?: Record<string, string | number>) => language === "es" ? translate("es", es, key, params) : translate("en", undefined, key, params);

const headers = (page: Page) => page.locator("#__root [data-accordion-component=AccordionItemButton]");

const setSidebarCollapsed = (page: Page, collapsed: boolean) =>
  page.evaluate((c) => {
    const bar = document.querySelector("[data-a-target^=side-nav-bar]")!;
    bar.setAttribute("data-a-target", c ? "side-nav-bar-collapsed" : "side-nav-bar");
    bar.classList.toggle("side-nav--collapsed", c);
    bar.classList.toggle("side-nav--expanded", !c);
  }, collapsed);

// A label as it appears in the page, for use in a selector
const labelled = (language: TwitchLanguage, english: string) => `[aria-label="${labelIn(language, english)}"]`;

for (const language of ["es", "xx"] as const) {
  test.describe(`with Twitch in ${language === "es" ? "Spanish" : "a made-up language"}`, () => {
    test.use({ twitchLanguage: language });
    const t = ui(language);

    test("the page really is translated", async ({ twitchPage }) => {
      await expect(twitchPage.locator(labelled(language, "Followed Channels"))).toHaveCount(1);
      await expect(twitchPage.locator("[aria-label='Followed Channels']")).toHaveCount(0);
    });

    test("the sidebar mounts, with its groups and the Manage Groups button, in front of the live channels", async ({ twitchPage }) => {
      await expect(headers(twitchPage).first()).toBeVisible({ timeout: 8_000 });
      await expect(twitchPage.getByRole("button", { name: t("manage.button") })).toBeVisible();
      const before = await twitchPage.evaluate(() => document.getElementById("__manage-groups-root")!.nextElementSibling?.getAttribute("aria-label"));
      expect(before).toBe(labelIn(language, "Live Channels"));
    });

    test("Twitch's own followed list is hidden by default", async ({ twitchPage }) => {
      await expect(twitchPage.locator(labelled(language, "Followed Channels"))).toBeHidden({ timeout: 8_000 });
    });

    for (const [toggle, english] of [
      ["popup.hide.live", "Live Channels"],
      ["popup.hide.categories", "Recommended Categories"],
      ["popup.hide.streaks", "Watch Streaks at risk"],
      ["popup.hide.viewersAlsoWatch", "FixtureChannel Viewers Also Watch"],
    ] as const) {
      test(`"${ui(language)(toggle)}" hides its section`, async ({ twitchPage, context, extensionId }) => {
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
        const target = twitchPage.locator(labelled(language, english));
        await expect(target).toBeVisible();

        await popup.getByRole("button", { name: new RegExp(t("popup.hideSections")) }).click();
        await popup.getByRole("switch", { name: t(toggle) }).click();
        await expect(target).toBeHidden({ timeout: 5_000 });
        await popup.getByRole("switch", { name: t(toggle) }).click();
        await expect(target).toBeVisible({ timeout: 5_000 });
      });
    }

    test("collapsing and expanding the side nav is noticed", async ({ twitchPage }) => {
      const manage = twitchPage.locator("#__manage-groups-root").getByRole("button", { name: t("manage.button") });
      await expect(manage).toHaveCount(1);
      await setSidebarCollapsed(twitchPage, true);
      await expect(manage).toHaveCount(0, { timeout: 5_000 });
      await expect(headers(twitchPage).first()).toContainText(new RegExp(`^\\s*${Array.from(t("group.default.name"))[0]}\\s*$`)); // in the narrow rail a header is its initial
      await setSidebarCollapsed(twitchPage, false);
      await expect(manage).toHaveCount(1, { timeout: 5_000 });
    });
  });
}
