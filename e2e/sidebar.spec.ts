import { test, expect } from "./extension";

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

// Known defects. test.fail() keeps the suite green while the bug exists and turns
// red when it is fixed, which is the cue to remove the annotation.
test.describe("known defects", () => {
  test.describe("page without a Stories section", () => {
    test.use({ removeStories: true });
    test.fail(true, "saved visibility is only applied when all three sidebar selectors are found");
    test("a fresh install hides the original Followed Channels list on load", async ({ twitchPage }) => {
      // onInstalled defaults hideOriginalFollowersList to true
      await expect(twitchPage.locator("[aria-label='Followed Channels']")).toBeHidden({ timeout: 8_000 });
    });
  });

});
