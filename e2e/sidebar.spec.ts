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

test("toggle message hides the Followed Channels section", async ({ twitchPage, worker }) => {
  const followed = twitchPage.locator("[aria-label='Followed Channels']");

  await worker.evaluate(async () => {
    const { globalState } = await chrome.storage.local.get("globalState");
    await chrome.storage.local.set({ globalState: { ...globalState, hideOriginalFollowersList: true } });
    const [tab] = await chrome.tabs.query({ url: "https://www.twitch.tv/*" });
    await chrome.tabs.sendMessage(tab.id!, { message: "SYS:Followers:TOGGLE_FOLLOWERS_SIDEBAR" });
  });

  await expect(followed).toBeHidden({ timeout: 5_000 });
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
  await expect(sidebar.getByText("Fixture_Live")).toBeVisible();
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
  await expect(sidebar.getByText("Fixture_Live")).toBeVisible();
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
