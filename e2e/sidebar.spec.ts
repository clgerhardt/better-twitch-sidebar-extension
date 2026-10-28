import { test, expect } from "./extension";
import type { Page } from "@playwright/test";

test("renders the Ungrouped group and Manage Groups button for a logged-in user", async ({ twitchPage }) => {
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");
  await expect(twitchPage.locator("#__manage-groups-root")).toContainText("Manage Groups");
});

test("a fresh install hides the original Followed Channels list on load", async ({ twitchPage }) => {
  await expect(twitchPage.locator("[aria-label='Followed Channels']")).toBeHidden({ timeout: 8_000 });
});

test("changing a setting in storage hides the Followed Channels section", async ({ twitchPage, worker }) => {
  const followed = twitchPage.locator("[aria-label='Followed Channels']");
  await worker.evaluate(async () => {
    const { globalState } = await chrome.storage.local.get("globalState");
    await chrome.storage.local.set({ globalState: { ...globalState, hideOriginalFollowersList: true } });
  });
  await expect(followed).toBeHidden({ timeout: 5_000 });
});

test("a setting reaches every open Twitch tab, including one in the background", async ({ twitchPage, openTwitch, worker }) => {
  const front = await openTwitch();
  await front.bringToFront(); // twitchPage is now in the background
  await worker.evaluate(async () => {
    const { globalState } = await chrome.storage.local.get("globalState");
    await chrome.storage.local.set({ globalState: { ...globalState, hideLiveChannels: true } });
  });
  await expect(twitchPage.locator("[aria-label='Live Channels']")).toBeHidden({ timeout: 5_000 });
  await expect(front.locator("[aria-label='Live Channels']")).toBeHidden({ timeout: 5_000 });

  await worker.evaluate(async () => {
    const { globalState } = await chrome.storage.local.get("globalState");
    await chrome.storage.local.set({ globalState: { ...globalState, hideLiveChannels: false } });
  });
  await expect(twitchPage.locator("[aria-label='Live Channels']")).toBeVisible({ timeout: 5_000 });
  await expect(front.locator("[aria-label='Live Channels']")).toBeVisible({ timeout: 5_000 });
});

// The hide switches sit in a collapsible group in the popup
const openHideSections = (popup: Page) => popup.getByRole("button", { name: /Hide sections/ }).click();

test("the popup's toggles work without being tied to the active tab", async ({ twitchPage, context, extensionId }) => {
  // The popup is open as a tab here, so the Twitch tab is not the active one
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  const live = twitchPage.locator("[aria-label='Live Channels']");
  await expect(live).toBeVisible();

  await openHideSections(popup);
  await popup.getByRole("switch", { name: "Hide Live Channels" }).click();
  await expect(live).toBeHidden({ timeout: 5_000 });
  await popup.getByRole("switch", { name: "Hide Live Channels" }).click();
  await expect(live).toBeVisible({ timeout: 5_000 });
});

for (const [label, section] of [
  ["Hide streaks", "[aria-label='Watch Streaks at risk']"],
  ["Hide recommended categories", "[aria-label='Recommended Categories']"],
  ["Hide \"viewers also watch\"", "[aria-label$='Viewers Also Watch']"],
] as const) {
  test(`the "${label}" toggle hides its section and shows it again`, async ({ twitchPage, context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
    const target = twitchPage.locator(section);
    await expect(target).toBeVisible();

    await openHideSections(popup);
    await popup.getByRole("switch", { name: label }).click();
    await expect(target).toBeHidden({ timeout: 5_000 });
    await popup.getByRole("switch", { name: label }).click();
    await expect(target).toBeVisible({ timeout: 5_000 });
  });
}

test("a Viewers Also Watch section that Twitch adds later is hidden too", async ({ twitchPage, context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await openHideSections(popup);
  await popup.getByRole("switch", { name: "Hide \"viewers also watch\"" }).click();
  await expect(twitchPage.locator("[aria-label$='Viewers Also Watch']")).toBeHidden({ timeout: 5_000 });

  // Navigating to another channel page: Twitch renders a new section
  await twitchPage.evaluate(() => {
    document.querySelector("[aria-label$='Viewers Also Watch']")!.remove();
    const section = document.createElement("div");
    section.className = "side-nav-section";
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", "OtherChannel Viewers Also Watch");
    // Twitch marks the rows of this section data-test-selector="similarity-channel"
    section.innerHTML = '<div data-test-selector="similarity-channel">OtherChannel Viewers Also Watch</div>';
    document.querySelector("[aria-label='Recommended Categories']")!.after(section);
  });
  await expect(twitchPage.locator("[aria-label='OtherChannel Viewers Also Watch']")).toBeHidden({ timeout: 5_000 });
});

test.describe("page without a Stories section", () => {
  test.use({ removeStories: true });

  test("a fresh install hides the original Followed Channels list on load", async ({ twitchPage }) => {
    // onInstalled defaults hideOriginalFollowersList to true
    await expect(twitchPage.locator("[aria-label='Followed Channels']")).toBeHidden({ timeout: 8_000 });
  });
});

test("reconnecting to the background does not rebuild the sidebar UI", async ({ twitchPage, context }) => {
  const manageButtons = twitchPage.locator("#__manage-groups-root").getByRole("button", { name: "Manage Groups" });
  await expect(manageButtons).toHaveCount(1);
  await expect(twitchPage.locator("#__root [role=button]").first()).toBeVisible();
  // Tag the rendered elements; a rebuilt UI would replace them and lose the tags
  await twitchPage.evaluate(() => {
    document.querySelector("#__manage-groups-root button")?.setAttribute("data-render-marker", "kept");
    document.querySelector("#__root [role=button]")?.setAttribute("data-render-marker", "kept");
  });

  // Chrome stops the service worker when idle and the content script reconnects each time
  const cdp = await context.newCDPSession(twitchPage);
  await cdp.send("ServiceWorker.enable");
  for (let i = 0; i < 6; i++) {
    await cdp.send("ServiceWorker.stopAllWorkers");
    await twitchPage.waitForTimeout(700);
  }
  await twitchPage.waitForTimeout(2_000);

  await expect(manageButtons).toHaveCount(1);
  await expect(twitchPage.locator("#__manage-groups-root button[data-render-marker=kept]")).toHaveCount(1);
  await expect(twitchPage.locator("#__root [role=button][data-render-marker=kept]")).toHaveCount(1);
});

// The fixture has no Twitch JavaScript, so swap the sidebar element the way Twitch does when it collapses or expands
const setSidebarCollapsed = (page: Page, collapsed: boolean) =>
  page.evaluate((c) => {
    const bar = document.querySelector("[data-a-target^=side-nav-bar]")!;
    bar.setAttribute("data-a-target", c ? "side-nav-bar-collapsed" : "side-nav-bar");
    bar.classList.toggle("side-nav--collapsed", c);
    bar.classList.toggle("side-nav--expanded", !c);
  }, collapsed);

test("collapsing the side nav hides the Manage Groups button", async ({ twitchPage }) => {
  const manage = twitchPage.locator("#__manage-groups-root").getByRole("button", { name: "Manage Groups" });
  await expect(manage).toHaveCount(1);
  await setSidebarCollapsed(twitchPage, true);
  await expect(manage).toHaveCount(0, { timeout: 5_000 });
  await setSidebarCollapsed(twitchPage, false);
  await expect(manage).toHaveCount(1, { timeout: 5_000 });
});

test("collapse and expand are still reported after the background reconnects", async ({ twitchPage, context }) => {
  const cdp = await context.newCDPSession(twitchPage);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await twitchPage.waitForTimeout(1_500);

  const manage = twitchPage.locator("#__manage-groups-root").getByRole("button", { name: "Manage Groups" });
  await expect(manage).toHaveCount(1);
  await setSidebarCollapsed(twitchPage, true);
  await expect(manage).toHaveCount(0, { timeout: 5_000 });
});

test("the sidebar does not store a second copy of the group list", async ({ twitchPage, worker }) => {
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");
  await expect.poll(async () => Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)))).toContain("channelSnapshot");
  expect(Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)))).not.toContain("followedChannels");
});

test("Manage Groups lists the channels from the snapshot, grouped, without a stored group list", async ({ twitchPage, worker }) => {
  await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Friends"], channelGroups: { fixture_live: "Friends" } }));
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await expect(dialog).toContainText("Friends");
  await expect(dialog).toContainText("Ungrouped");
});

const manageButton = (page: Page) => page.locator("#__manage-groups-root").getByRole("button", { name: "Manage Groups" });

test("no per-tab sidebar state is stored", async ({ twitchPage, worker }) => {
  await expect(manageButton(twitchPage)).toHaveCount(1);
  await setSidebarCollapsed(twitchPage, true);
  await expect(manageButton(twitchPage)).toHaveCount(0, { timeout: 5_000 });
  const keys = Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)));
  expect(keys.filter((key) => key.includes("sideBarStateByTab"))).toEqual([]);
});

test("data left behind by older versions is removed when the background starts", async ({ session, context, worker, extensionId }) => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      followedChannels: [{ groupName: "Old", followedChannels: [] }],
      sideBarStateByTab: { "1": { sidebarExpanded: true } },
      bttvSidebar_sideBarStateByTab: { "2": { sidebarExpanded: true } },
    })
  );
  // Stop the worker; the message below wakes it, and it cleans up as it starts
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/pages/options/index.html`);
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await page.waitForTimeout(1_000);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: "REFRESH_CHANNELS" }));

  await expect
    .poll(async () => Object.keys(await page.evaluate(() => chrome.storage.local.get(null))).filter((key) => ["followedChannels", "sideBarStateByTab", "bttvSidebar_sideBarStateByTab"].includes(key)))
    .toEqual([]);
});

test("a tab in the background follows its own collapse button", async ({ twitchPage, openTwitch }) => {
  await expect(manageButton(twitchPage)).toHaveCount(1);
  const front = await openTwitch(); // now the active tab; twitchPage is in the background
  await front.bringToFront();

  await setSidebarCollapsed(twitchPage, true);
  await expect(manageButton(twitchPage)).toHaveCount(0, { timeout: 5_000 });
  await expect(manageButton(front)).toHaveCount(1); // the other tab is untouched
  await setSidebarCollapsed(twitchPage, false);
  await expect(manageButton(twitchPage)).toHaveCount(1, { timeout: 5_000 });
});

test.describe("Manage Groups button", () => {
  test("is a compact outlined purple button, not a big pill", async ({ twitchPage }) => {
    await expect(manageButton(twitchPage)).toBeVisible();
    const m = await manageButton(twitchPage).evaluate((el) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const cs = getComputedStyle(el);
      return {
        heightRem: el.getBoundingClientRect().height / rem,
        radiusRem: parseFloat(cs.borderTopLeftRadius) / rem,
        border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
        background: cs.backgroundColor,
        hasIcon: !!el.querySelector("svg"),
      };
    });
    expect(m.heightRem).toBeLessThanOrEqual(3.6);
    expect(m.radiusRem).toBeGreaterThan(0.2);
    expect(m.radiusRem).toBeLessThan(1);
    expect(m.border).toBe("2px solid rgb(168, 85, 247)");
    expect(m.background).toBe("rgba(0, 0, 0, 0)"); // outlined, not filled
    expect(m.hasIcon).toBe(true);
  });

  test("is as wide as the channel rows and fits in its space", async ({ twitchPage }) => {
    await expect(manageButton(twitchPage)).toBeVisible();
    const m = await twitchPage.evaluate(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const nav = document.querySelector("[data-a-target=side-nav-bar]")!.getBoundingClientRect();
      const root = document.querySelector("#__manage-groups-root")!.getBoundingClientRect();
      const button = document.querySelector("#__manage-groups-root button")!.getBoundingClientRect();
      return { left: (button.left - nav.left) / rem, right: (nav.right - button.right) / rem, overflow: button.bottom - root.bottom };
    });
    expect(m.left).toBeLessThanOrEqual(0.5);
    expect(m.right).toBeLessThanOrEqual(0.5);
    expect(m.overflow).toBeLessThanOrEqual(1); // it does not spill out of its container into the next section
  });

  test("lights up under the mouse and still opens the dialog", async ({ twitchPage }) => {
    const before = await manageButton(twitchPage).evaluate((el) => getComputedStyle(el).backgroundColor);
    await manageButton(twitchPage).hover();
    await expect.poll(() => manageButton(twitchPage).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(before);
    await manageButton(twitchPage).click();
    await expect(twitchPage.getByRole("dialog")).toContainText("Ungrouped");
  });
});

test("a page that loads with the side nav collapsed starts collapsed", async ({ session, context }) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const bar = document.querySelector("[data-a-target=side-nav-bar]");
      bar?.setAttribute("data-a-target", "side-nav-bar-collapsed");
      bar?.classList.replace("side-nav--expanded", "side-nav--collapsed");
    });
  });
  await page.goto("https://www.twitch.tv/");
  await page.locator("#__root").waitFor({ state: "attached" });
  await page.waitForTimeout(800);
  await expect(manageButton(page)).toHaveCount(0);
  await setSidebarCollapsed(page, false);
  await expect(manageButton(page)).toHaveCount(1, { timeout: 5_000 });
});

test("the page opens no port to the background", async ({ session, context, worker }) => {
  await worker.evaluate(() => {
    (self as any).__ports = [];
    chrome.runtime.onConnect.addListener((port) => (self as any).__ports.push(port.name));
  });
  const page = await context.newPage();
  await page.goto("https://www.twitch.tv/");
  await expect(page.locator("#__root")).toContainText("Ungrouped");
  await page.waitForTimeout(1_000);
  expect(await worker.evaluate(() => (self as any).__ports)).toEqual([]);
});

test("the sidebar is put back when Twitch removes it from the page", async ({ twitchPage }) => {
  await expect(manageButton(twitchPage)).toHaveCount(1);
  await twitchPage.evaluate(() => {
    document.getElementById("__root")?.remove();
    document.getElementById("__manage-groups-root")?.remove();
  });
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped", { timeout: 5_000 });
  await expect(manageButton(twitchPage)).toHaveCount(1, { timeout: 5_000 });
  await expect(twitchPage.locator("#__root")).toHaveCount(1);
  await expect(twitchPage.locator("#__manage-groups-root")).toHaveCount(1);
});

test("the sidebar is put back when the section it sits before is replaced", async ({ twitchPage }) => {
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");
  // Twitch re-rendering the sidebar replaces the sections with fresh copies and drops our roots
  await twitchPage.evaluate(() => {
    const live = document.querySelector("[aria-label='Live Channels']")!;
    const copy = live.cloneNode(true);
    document.getElementById("__root")?.remove();
    document.getElementById("__manage-groups-root")?.remove();
    live.replaceWith(copy);
  });
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped", { timeout: 5_000 });
  await expect(twitchPage.locator("#__root")).toHaveCount(1);
  await expect(manageButton(twitchPage)).toHaveCount(1);
});

test("the sidebar needs no background to stay put or to come back", async ({ twitchPage, context }) => {
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");
  const cdp = await context.newCDPSession(twitchPage);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await twitchPage.waitForTimeout(1_500);
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped");
  await expect(manageButton(twitchPage)).toHaveCount(1);

  // Even with the worker stopped, a removed sidebar is put back by the page itself
  await twitchPage.evaluate(() => {
    document.getElementById("__root")?.remove();
    document.getElementById("__manage-groups-root")?.remove();
  });
  await expect(twitchPage.locator("#__root")).toContainText("Ungrouped", { timeout: 5_000 });
  await expect(manageButton(twitchPage)).toHaveCount(1, { timeout: 5_000 });
});

test.describe("group headers", () => {
  const header = (page: Page, name: string) => page.locator("#__root").getByRole("button", { name: new RegExp(name) }).first();

  test("are compact rows, not big filled blocks", async ({ twitchPage }) => {
    const box = (await header(twitchPage, "Ungrouped").boundingBox())!;
    const rem = await twitchPage.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)); // Twitch uses 10px
    expect(box.height / rem).toBeLessThanOrEqual(3.2);
    const background = await header(twitchPage, "Ungrouped").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe("rgb(168, 85, 247)"); // the old solid purple block
  });

  test("show how many channels in the group are live", async ({ twitchPage }) => {
    await expect(header(twitchPage, "Ungrouped").getByTestId("group-live-count")).toHaveText("2");
    await expect(header(twitchPage, "Ungrouped")).toHaveAttribute("title", /2 live of 3/);
  });

  test("every group, Ungrouped included, has a purple rail", async ({ twitchPage, worker }) => {
    await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Friends"] }));
    await expect(header(twitchPage, "Friends")).toBeVisible();
    const rail = (name: string) => header(twitchPage, name).evaluate((el) => getComputedStyle(el).borderLeftColor);
    expect(await rail("Friends")).toBe("rgb(168, 85, 247)");
    expect(await rail("Ungrouped")).toBe("rgb(168, 85, 247)");
  });

  test("show the rail even though Twitch resets every div's border", async ({ twitchPage }) => {
    const rail = await header(twitchPage, "Ungrouped").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.borderLeftWidth, style: cs.borderLeftStyle };
    });
    expect(rail).toEqual({ width: "3px", style: "solid" });
  });

  test("run from the left edge of the sidebar to the right edge", async ({ twitchPage }) => {
    await expect(header(twitchPage, "Ungrouped")).toBeVisible();
    const m = await twitchPage.evaluate(() => {
      const nav = document.querySelector("[data-a-target=side-nav-bar]")!.getBoundingClientRect();
      const button = document.querySelector("#__root [role=button]")!.getBoundingClientRect();
      const bar = document.querySelector("[data-testid=refresh-progress]")!.getBoundingClientRect();
      return {
        headerLeft: Math.round(button.left - nav.left),
        headerRight: Math.round(nav.right - button.right),
        barLeft: Math.round(bar.left - nav.left),
        barRight: Math.round(nav.right - bar.right),
      };
    });
    expect(m).toEqual({ headerLeft: 0, headerRight: 0, barLeft: 0, barRight: 0 });
  });

  test("are actually painted at the sidebar edges, not clipped short", async ({ twitchPage }) => {
    await expect(header(twitchPage, "Ungrouped")).toBeVisible();
    const hit = await twitchPage.evaluate(() => {
      const nav = document.querySelector("[data-a-target=side-nav-bar]")!.getBoundingClientRect();
      const button = document.querySelector("#__root [role=button]")!;
      const y = button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2;
      const owner = (x: number) => document.elementFromPoint(x, y)?.closest("[role=button]") === button;
      return { leftEdge: owner(nav.left + 1), rightEdge: owner(nav.right - 2) };
    });
    expect(hit).toEqual({ leftEdge: true, rightEdge: true });
  });

  test("have their own tinted background, different from the rows below", async ({ twitchPage }) => {
    const background = await header(twitchPage, "Ungrouped").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    expect(background).toContain("/ 0.08"); // an 8% tint of the text color, so it works on light and dark themes
  });

  test("sit on the sidebar without a box around the accordion", async ({ twitchPage }) => {
    await expect(header(twitchPage, "Ungrouped")).toHaveAttribute("aria-expanded", "true");
    const style = await twitchPage.evaluate(() => {
      const accordion = document.querySelector("#__root [data-accordion-component=Accordion]")!;
      const panel = document.querySelector("#__root [data-accordion-component=AccordionItemPanel]")!;
      const button = document.querySelector("#__root [role=button]")!;
      return {
        accordionBorder: getComputedStyle(accordion).borderTopWidth,
        panelPaddingLeft: getComputedStyle(panel).paddingLeft,
        buttonArrow: getComputedStyle(button, "::before").content,
      };
    });
    expect(style).toEqual({ accordionBorder: "0px", panelPaddingLeft: "4px", buttonArrow: "none" });
  });

  test.describe("hovering a channel row", () => {
    const rowFor = (page: Page, login: string) => page.locator(`#__root a.side-nav-card__link[href="/${login}"]`);

    test("shows the stream title beside a live row, as Twitch does", async ({ twitchPage }) => {
      const row = rowFor(twitchPage, "fixture_live");
      await row.hover();
      const tip = twitchPage.getByRole("tooltip");
      await expect(tip).toHaveText("Fixture live stream title");
      const [tipBox, rowBox] = [(await tip.boundingBox())!, (await row.boundingBox())!];
      expect(tipBox.x).toBeGreaterThanOrEqual(rowBox.x + rowBox.width);
      await twitchPage.mouse.move(600, 600);
      await expect(tip).toHaveCount(0);
    });

    test("shows nothing for an offline row", async ({ twitchPage }) => {
      await rowFor(twitchPage, "fixture_offline").hover();
      await twitchPage.waitForTimeout(400);
      await expect(twitchPage.getByRole("tooltip")).toHaveCount(0);
    });
  });

  test.describe("when the side nav is collapsed", () => {
    test.beforeEach(async ({ twitchPage, worker }) => {
      await worker.evaluate(() => chrome.storage.local.set({ groupNames: ["Friends"] }));
      await expect(header(twitchPage, "Friends")).toBeVisible();
      await setSidebarCollapsed(twitchPage, true);
      await expect(manageButton(twitchPage)).toHaveCount(0, { timeout: 5_000 });
    });

    test("each header shows its group's initial", async ({ twitchPage }) => {
      await expect(twitchPage.locator("#__root").getByRole("button", { name: "Friends" })).toContainText("F");
      await expect(twitchPage.locator("#__root").getByRole("button", { name: "Ungrouped" })).toContainText("U");
    });

    test("channel rows show only the avatar, and get their text back when expanded", async ({ twitchPage }) => {
      const row = twitchPage.locator("#__root a.side-nav-card__link").first();
      await expect(row.locator("img")).toHaveCount(1);
      await expect(row.locator("[data-a-target=side-nav-title]")).toHaveCount(0);
      await expect(row).toHaveAttribute("aria-label", /\S/);
      await setSidebarCollapsed(twitchPage, false);
      await expect(twitchPage.locator("#__root a.side-nav-card__link [data-a-target=side-nav-title]").first()).toBeVisible();
    });

    test("hovering a channel avatar shows its name and stream title", async ({ twitchPage }) => {
      await twitchPage.locator("#__root a.side-nav-card__link[href='/fixture_live']").hover();
      const tip = twitchPage.getByRole("tooltip");
      await expect(tip).toContainText("Fixture_Live");
      await expect(tip).toContainText("Fixture live stream title");
    });

    test("an empty group shows a short mark that fits, not the full sentence", async ({ twitchPage }) => {
      const friends = twitchPage.locator("#__root").getByRole("button", { name: "Friends" });
      await friends.click();
      const container = twitchPage.locator("#__root [data-accordion-component=AccordionItemPanel]:visible [data-testid=group-container]").last();
      const mark = container.locator("span[aria-hidden=true]");
      await expect(mark).toHaveText("—");
      const [markBox, sidebarBox] = [(await mark.boundingBox())!, (await twitchPage.locator("#__root").boundingBox())!];
      expect(markBox.x + markBox.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width);
      await container.hover();
      await expect(twitchPage.getByRole("tooltip")).toHaveText("No channels");
      await twitchPage.mouse.move(600, 600);
      await expect(twitchPage.getByRole("tooltip")).toHaveCount(0);
    });

    test("hovering a header says which group it is, to the right of the sidebar", async ({ twitchPage }) => {
      const friends = twitchPage.locator("#__root").getByRole("button", { name: "Friends" });
      await friends.hover();
      const tip = twitchPage.getByRole("tooltip");
      await expect(tip).toBeVisible();
      await expect(tip).toContainText("Friends");
      await expect(tip).toContainText("0 live");
      const [tipBox, headerBox] = [(await tip.boundingBox())!, (await friends.boundingBox())!];
      expect(tipBox.x).toBeGreaterThanOrEqual(headerBox.x + headerBox.width);

      await twitchPage.mouse.move(600, 600);
      await expect(tip).toHaveCount(0);
    });

    test("keyboard focus shows the tooltip too", async ({ twitchPage }) => {
      await twitchPage.locator("#__root").getByRole("button", { name: "Friends" }).focus();
      await expect(twitchPage.getByRole("tooltip")).toContainText("Friends");
    });

    test("the tooltip is not clipped by the sidebar", async ({ twitchPage }) => {
      await twitchPage.locator("#__root").getByRole("button", { name: "Friends" }).hover();
      const tip = twitchPage.getByRole("tooltip");
      await expect(tip).toBeVisible();
      const box = (await tip.boundingBox())!;
      const hit = await twitchPage.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[role=tooltip]") !== null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(hit).toBe(true);
    });
  });

  test("when expanded, hovering a header shows no tooltip", async ({ twitchPage }) => {
    await header(twitchPage, "Ungrouped").hover();
    await twitchPage.waitForTimeout(400);
    await expect(twitchPage.getByRole("tooltip")).toHaveCount(0);
  });

  test("still open and close their channel list", async ({ twitchPage }) => {
    const ungrouped = header(twitchPage, "Ungrouped");
    await expect(ungrouped).toHaveAttribute("aria-expanded", "true");
    await expect(twitchPage.locator("#__root")).toContainText("Fixture_Live");
    await ungrouped.click();
    await expect(ungrouped).toHaveAttribute("aria-expanded", "false");
    await ungrouped.click();
    await expect(ungrouped).toHaveAttribute("aria-expanded", "true");
  });

  test("open the first group on load", async ({ twitchPage }) => {
    await expect(header(twitchPage, "Ungrouped")).toHaveAttribute("aria-expanded", "true");
  });
});
