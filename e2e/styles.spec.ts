import { test, expect } from "./extension";

// The content script's CSS is injected into every twitch.tv page. It must not restyle
// Twitch's own elements (Tailwind's global reset used to break Twitch's promo banners).
test("the extension's CSS does not restyle Twitch's own elements", async ({ twitchPage }) => {
  const styles = await twitchPage.evaluate(() => {
    const cs = (el: Element) => getComputedStyle(el);
    const link = document.querySelector("a.side-nav-card__link")!;
    const img = link.querySelector("img")!;
    const heading = document.querySelector("h3")!;
    const nav = document.querySelector("[data-a-target=side-nav-bar]")!;
    return {
      imgDisplay: cs(img).display,
      imgMaxWidth: cs(img).maxWidth,
      linkDecoration: cs(link).textDecorationLine,
      headingMargin: cs(heading).marginTop,
      navBoxSizing: cs(nav).boxSizing,
      navBorderStyle: cs(nav).borderTopStyle,
    };
  });

  expect(styles).toEqual({
    imgDisplay: "inline",
    imgMaxWidth: "none",
    linkDecoration: "underline",
    headingMargin: "11.7px",
    navBoxSizing: "content-box",
    navBorderStyle: "none",
  });
});

test("the extension's own UI keeps its styling", async ({ twitchPage }) => {
  const manage = twitchPage.locator("#__manage-groups-root button").first();
  await expect(manage).toBeVisible();
  const header = twitchPage.locator("#__root [role=button]").first();
  await expect(header).toBeVisible();

  const ui = await twitchPage.evaluate(() => {
    const cs = (el: Element) => getComputedStyle(el);
    const m = document.querySelector("#__manage-groups-root button")!;
    const h = document.querySelector("#__root [role=button]")!;
    return {
      manageBg: cs(m).backgroundColor,
      manageRadius: cs(m).borderRadius,
      manageBorderStyle: cs(m).borderTopStyle,
      manageBorderWidth: cs(m).borderTopWidth,
      headerBg: cs(h).backgroundColor,
      headerBoxSizing: cs(h).boxSizing,
    };
  });
  expect(ui).toEqual({
    manageBg: "rgba(0, 0, 0, 0)",
    manageRadius: "3.75px",
    manageBorderStyle: "solid",
    manageBorderWidth: "2px",
    headerBg: "color(srgb 0.937255 0.937255 0.945098 / 0.08)",
    headerBoxSizing: "border-box",
  });

  // The dialog renders in a portal outside the extension's containers
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  const input = dialog.getByPlaceholder("Add group");
  await expect(input).toBeVisible();
  const field = await input.evaluate((el) => {
    const c = getComputedStyle(el);
    return { borderStyle: c.borderTopStyle, borderWidth: c.borderTopWidth, boxSizing: c.boxSizing };
  });
  expect(field).toEqual({ borderStyle: "solid", borderWidth: "1px", boxSizing: "border-box" });
});
