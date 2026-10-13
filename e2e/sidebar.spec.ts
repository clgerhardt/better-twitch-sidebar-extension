import { test, expect } from "./extension";
import type { Locator, Page } from "@playwright/test";

const addGroup = async (page: Page, name: string) => {
  await page.getByPlaceholder("Add group").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(name);
};

// Expands the Ungrouped row, selects its first channel and moves it to `group`
const moveFirstChannelTo = async (dialog: Locator, group: string) => {
  await dialog.getByRole("button", { name: /expand row/i }).first().click();
  await dialog.locator("input[name^=select-row]").first().check();
  await dialog.locator("#groups-select").selectOption({ label: group });
  await dialog.getByRole("button", { name: "move-channel" }).click();
  await dialog.getByRole("button", { name: /collapse row/i }).first().click();
};

const groupRow = (dialog: Locator, name: string) => dialog.getByRole("row").filter({ hasText: name }).first();

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

test("the popup's toggles work without being tied to the active tab", async ({ twitchPage, context, extensionId }) => {
  // The popup is open as a tab here, so the Twitch tab is not the active one
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  const live = twitchPage.locator("[aria-label='Live Channels']");
  await expect(live).toBeVisible();

  await popup.getByRole("switch", { name: "Hide Live Channels" }).click();
  await expect(live).toBeHidden({ timeout: 5_000 });
  await popup.getByRole("switch", { name: "Hide Live Channels" }).click();
  await expect(live).toBeVisible({ timeout: 5_000 });
});

test("Manage Groups lists the groups shown in the sidebar", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await expect(dialog).toContainText("Ungrouped");
  await expect(dialog).not.toContainText("There are no records to display");
});

test("a group added in Manage Groups appears in the sidebar and the dialog", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  await twitchPage.getByPlaceholder("Add group").fill("Zebra Squad");
  await twitchPage.getByRole("button", { name: "Add", exact: true }).click();

  const dialog = twitchPage.getByRole("dialog");
  await expect(dialog).toContainText("Zebra Squad", { timeout: 5_000 });
  await twitchPage.keyboard.press("Escape");
  await expect(twitchPage.locator("#__root")).toContainText("Zebra Squad", { timeout: 5_000 });
});

test("moving a channel to a group updates the dialog and the sidebar", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await twitchPage.getByPlaceholder("Add group").fill("Zebra Squad");
  await twitchPage.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toContainText("Zebra Squad");

  // Expand Ungrouped, select a channel, move it
  await dialog.getByRole("button", { name: /expand row/i }).first().click();
  await dialog.locator("input[name^=select-row]").first().check();
  await dialog.locator("#groups-select").selectOption("Zebra Squad");
  await dialog.getByRole("button", { name: "move-channel" }).click();

  const zebraRow = dialog.getByRole("row").filter({ hasText: "Zebra Squad" }).first();
  await expect(zebraRow).toContainText("1", { timeout: 2_000 });
  await twitchPage.keyboard.press("Escape");

  const sidebar = twitchPage.locator("#__root");
  await sidebar.getByRole("button", { name: /Zebra Squad/ }).click();
  // The first channel in the list is the one with the most viewers (FixtureStreak)
  await expect(sidebar.getByText("FixtureStreak").first()).toBeVisible();
});

test("renaming a group keeps its channels and updates the sidebar", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await addGroup(twitchPage, "Zebra Squad");
  await moveFirstChannelTo(dialog, "Zebra Squad");

  await groupRow(dialog, "Zebra Squad").getByRole("button", { name: "edit-group-name" }).click();
  await dialog.getByPlaceholder("Updated Name").fill("Quagga Crew");
  await dialog.getByRole("button", { name: "save-group-name" }).click();

  await expect(dialog).toContainText("Quagga Crew");
  await expect(dialog).not.toContainText("Zebra Squad");
  await expect(groupRow(dialog, "Quagga Crew")).toContainText("1");
  await twitchPage.keyboard.press("Escape");

  const sidebar = twitchPage.locator("#__root");
  await expect(sidebar).not.toContainText("Zebra Squad");
  await sidebar.getByRole("button", { name: /Quagga Crew/ }).click();
  // The first channel in the list is the one with the most viewers (FixtureStreak)
  await expect(sidebar.getByText("FixtureStreak").first()).toBeVisible();
});

test("a group can be renamed to a different capitalisation of its own name", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await addGroup(twitchPage, "zebra squad");

  await groupRow(dialog, "zebra squad").getByRole("button", { name: "edit-group-name" }).click();
  await dialog.getByPlaceholder("Updated Name").fill("Zebra Squad");
  await expect(dialog).not.toContainText("already exists");
  await dialog.getByRole("button", { name: "save-group-name" }).click();

  await expect(dialog.getByText("Zebra Squad", { exact: true })).toBeVisible();
  await expect(dialog.getByText("zebra squad", { exact: true })).toHaveCount(0);
});

test("group names are unique regardless of case", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await addGroup(twitchPage, "Alpha");
  await addGroup(twitchPage, "Beta");

  // Adding a different-case duplicate is rejected
  await twitchPage.getByPlaceholder("Add group").fill("ALPHA");
  await expect(dialog).toContainText("Group name already exists");
  await expect(dialog.getByRole("button", { name: "Add", exact: true })).toBeDisabled();

  // So is renaming another group to it
  await groupRow(dialog, "Beta").getByRole("button", { name: "edit-group-name" }).click();
  await dialog.getByPlaceholder("Updated Name").fill("alpha");
  await expect(dialog).toContainText("Group name already exists");
  await expect(dialog.getByRole("button", { name: "save-group-name" })).toBeDisabled();
});

test("deleting a group sends its channels back to Ungrouped", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await addGroup(twitchPage, "Zebra Squad");
  await moveFirstChannelTo(dialog, "Zebra Squad");
  await expect(groupRow(dialog, "Ungrouped")).toContainText("2");

  await groupRow(dialog, "Zebra Squad").getByRole("button", { name: "delete-group" }).click();
  await dialog.getByRole("button", { name: "Are you sure?" }).click();

  await expect(dialog).not.toContainText("Zebra Squad");
  await expect(groupRow(dialog, "Ungrouped")).toContainText("3");
  await twitchPage.keyboard.press("Escape");
  await expect(twitchPage.locator("#__root")).not.toContainText("Zebra Squad");
});

test("the default group cannot be renamed or deleted", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const row = groupRow(twitchPage.getByRole("dialog"), "Ungrouped");
  await expect(row).toContainText("Cannot delete default group");
  await expect(row.getByRole("button", { name: "edit-group-name" })).toHaveCount(0);
});

test("adding a group does not refetch from the Twitch API", async ({ twitchPage }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  await expect(twitchPage.getByRole("dialog")).toContainText("Ungrouped");

  const apiCalls: string[] = [];
  twitchPage.on("request", (req) => {
    if (req.url().startsWith("https://api.twitch.tv/")) apiCalls.push(req.url());
  });

  await twitchPage.getByPlaceholder("Add group").fill("Quick Group");
  await twitchPage.getByRole("button", { name: "Add", exact: true }).click();
  // Fast timeout: the group must appear from stored data, not after a refetch
  await expect(twitchPage.getByRole("dialog")).toContainText("Quick Group", { timeout: 200 });
  expect(apiCalls).toEqual([]);
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

// The fixture has no Twitch JavaScript, so flip the arrow's label the way Twitch does when the side nav changes
const setSideNavLabel = (page: Page, label: "Expand Side Nav" | "Collapse Side Nav") =>
  page.locator("[data-a-target=side-nav-arrow]").evaluate((el, l) => el.setAttribute("aria-label", l), label);

test("collapsing the side nav hides the Manage Groups button", async ({ twitchPage }) => {
  const manage = twitchPage.locator("#__manage-groups-root").getByRole("button", { name: "Manage Groups" });
  await expect(manage).toHaveCount(1);
  await setSideNavLabel(twitchPage, "Expand Side Nav");
  await expect(manage).toHaveCount(0, { timeout: 5_000 });
  await setSideNavLabel(twitchPage, "Collapse Side Nav");
  await expect(manage).toHaveCount(1, { timeout: 5_000 });
});

test("collapse and expand are still reported after the background reconnects", async ({ twitchPage, context }) => {
  const cdp = await context.newCDPSession(twitchPage);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await twitchPage.waitForTimeout(1_500);

  const manage = twitchPage.locator("#__manage-groups-root").getByRole("button", { name: "Manage Groups" });
  await expect(manage).toHaveCount(1);
  await setSideNavLabel(twitchPage, "Expand Side Nav");
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

test("loading a Twitch page stores no per-tab sidebar state", async ({ twitchPage, worker }) => {
  await expect(manageButton(twitchPage)).toHaveCount(1);
  // The background still creates an empty list on install (removed in a later phase); no tab may have an entry
  const stored = await worker.evaluate(() => chrome.storage.local.get(null));
  for (const [key, value] of Object.entries(stored)) {
    if (key.includes("sideBarStateByTab")) expect(Object.keys(value as object), key).toEqual([]);
  }
});

test("a tab in the background follows its own collapse button", async ({ twitchPage, openTwitch }) => {
  await expect(manageButton(twitchPage)).toHaveCount(1);
  const front = await openTwitch(); // now the active tab; twitchPage is in the background
  await front.bringToFront();

  await setSideNavLabel(twitchPage, "Expand Side Nav");
  await expect(manageButton(twitchPage)).toHaveCount(0, { timeout: 5_000 });
  await expect(manageButton(front)).toHaveCount(1); // the other tab is untouched
  await setSideNavLabel(twitchPage, "Collapse Side Nav");
  await expect(manageButton(twitchPage)).toHaveCount(1, { timeout: 5_000 });
});

test("a page that loads with the side nav collapsed starts collapsed", async ({ session, context }) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelector("[data-a-target=side-nav-arrow]")?.setAttribute("aria-label", "Expand Side Nav");
    });
  });
  await page.goto("https://www.twitch.tv/");
  await page.locator("#__root").waitFor({ state: "attached" });
  await page.waitForTimeout(800);
  await expect(manageButton(page)).toHaveCount(0);
  await setSideNavLabel(page, "Collapse Side Nav");
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
