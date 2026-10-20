import { test, expect } from "./extension";
import type { Locator, Page } from "@playwright/test";

const open = async (page: Page) => {
  await page.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Ungrouped");
  return dialog;
};

const groupButton = (dialog: Locator, name: string) => dialog.getByRole("list", { name: "Groups" }).getByRole("button", { name: new RegExp(`^${name}`) });

const addGroup = async (dialog: Locator, name: string) => {
  await dialog.getByPlaceholder("Add group").fill(name);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(groupButton(dialog, name)).toBeVisible();
};

test.describe("Manage Groups dialog", () => {
  test("is a dark Twitch-style panel with groups on the left and channels on the right", async ({ twitchPage }) => {
    const dialog = await open(twitchPage);
    await expect(dialog.getByRole("heading", { name: "Manage groups" })).toBeVisible();
    await expect(dialog.getByRole("list", { name: "Groups" })).toBeVisible();
    await expect(dialog.getByPlaceholder("Search channels")).toBeVisible();

    const panel = await dialog.locator("[data-testid=dialog-panel]").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(panel).toBe("rgb(24, 24, 27)");
  });

  test("lists the groups with their channel counts, Ungrouped selected first", async ({ twitchPage }) => {
    const dialog = await open(twitchPage);
    await expect(groupButton(dialog, "Ungrouped")).toContainText("3");
    await expect(groupButton(dialog, "Ungrouped")).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("heading", { name: "Ungrouped" })).toBeVisible();
    await expect(dialog).toContainText("Fixture_Live");
    await expect(dialog).toContainText("fixture_offline");
  });

  test("group buttons have only a purple rail on the left, not a box", async ({ twitchPage }) => {
    const dialog = await open(twitchPage);
    const widths = await groupButton(dialog, "Ungrouped").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { top: cs.borderTopWidth, right: cs.borderRightWidth, bottom: cs.borderBottomWidth, left: cs.borderLeftWidth, leftColor: cs.borderLeftColor };
    });
    expect(widths).toEqual({ top: "0px", right: "0px", bottom: "0px", left: "3px", leftColor: "rgb(168, 85, 247)" });
  });

  test("closes with Escape and with the close button", async ({ twitchPage }) => {
    const dialog = await open(twitchPage);
    await twitchPage.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await open(twitchPage);
    await twitchPage.getByRole("button", { name: "Close" }).click();
    await expect(twitchPage.getByRole("dialog")).toHaveCount(0);
  });

  test.describe("adding groups", () => {
    test("a new group appears in the list, is selected, and shows in the sidebar", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await expect(groupButton(dialog, "Zebra Squad")).toHaveAttribute("aria-pressed", "true");
      await expect(groupButton(dialog, "Zebra Squad")).toContainText("0");
      await twitchPage.keyboard.press("Escape");
      await expect(twitchPage.locator("#__root")).toContainText("Zebra Squad", { timeout: 5_000 });
    });

    test("does not refetch from the Twitch API", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      const apiCalls: string[] = [];
      twitchPage.on("request", (req) => {
        if (req.url().startsWith("https://api.twitch.tv/")) apiCalls.push(req.url());
      });
      await dialog.getByPlaceholder("Add group").fill("Quick Group");
      await dialog.getByRole("button", { name: "Add", exact: true }).click();
      // Fast timeout: the group must appear from stored data, not after a refetch
      await expect(groupButton(dialog, "Quick Group")).toBeVisible({ timeout: 500 });
      expect(apiCalls).toEqual([]);
    });

    test("the field is cleared after adding and Add is disabled until the name is valid", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      const add = dialog.getByRole("button", { name: "Add", exact: true });
      await expect(add).toBeDisabled();
      await dialog.getByPlaceholder("Add group").fill("Zebra Squad");
      await expect(add).toBeEnabled();
      await add.click();
      await expect(dialog.getByPlaceholder("Add group")).toHaveValue("");
      await expect(add).toBeDisabled();
    });

    test("shows why a name is not allowed", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      const field = dialog.getByPlaceholder("Add group");
      await field.fill("ab");
      await expect(dialog).toContainText("Group name must be at least 3 characters");
      await field.fill("a".repeat(16));
      await expect(dialog).toContainText("Group name cannot be over 15 characters");
      await field.fill("ungrouped");
      await expect(dialog).toContainText("Group name already exists");
      await expect(dialog.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
    });

    test("names are unique whatever their capitalisation", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Alpha");
      await dialog.getByPlaceholder("Add group").fill("ALPHA");
      await expect(dialog).toContainText("Group name already exists");
      await expect(dialog.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
    });
  });

  test.describe("reordering groups", () => {
    const listOrder = (dialog: Locator) => dialog.getByRole("list", { name: "Groups" }).getByRole("listitem").evaluateAll((items) => items.map((li) => li.querySelector("button span")!.textContent));
    const sidebarOrder = (page: Page) => page.locator("#__root [data-accordion-component=AccordionItemButton]").evaluateAll((buttons) => buttons.map((b) => (b.querySelector("#expanded-side-bar-heading") as HTMLElement).innerText));

    test("moves a group up and down, in the dialog and the sidebar", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      for (const name of ["Alpha", "Beta", "Gamma"]) await addGroup(dialog, name);
      expect(await listOrder(dialog)).toEqual(["Ungrouped", "Alpha", "Beta", "Gamma"]);

      await dialog.getByRole("button", { name: "Move Gamma up" }).click();
      await expect.poll(() => listOrder(dialog)).toEqual(["Ungrouped", "Alpha", "Gamma", "Beta"]);
      await dialog.getByRole("button", { name: "Move Alpha down" }).click();
      await expect.poll(() => listOrder(dialog)).toEqual(["Ungrouped", "Gamma", "Alpha", "Beta"]);
      await expect.poll(() => sidebarOrder(twitchPage)).toEqual(["Ungrouped", "Gamma", "Alpha", "Beta"]);
    });

    test("the default group can be moved like any other", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      for (const name of ["Alpha", "Beta"]) await addGroup(dialog, name);
      await dialog.getByRole("button", { name: "Move Ungrouped down" }).click();
      await expect.poll(() => listOrder(dialog)).toEqual(["Alpha", "Ungrouped", "Beta"]);
      await expect.poll(() => sidebarOrder(twitchPage)).toEqual(["Alpha", "Ungrouped", "Beta"]);
    });

    test("the first and last groups cannot move past the ends", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      for (const name of ["Alpha", "Beta"]) await addGroup(dialog, name);
      await expect(dialog.getByRole("button", { name: "Move Ungrouped up" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Move Beta down" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Move Alpha down" })).toBeEnabled();
      await expect(dialog.getByRole("button", { name: "Move Alpha down" })).toHaveAttribute("title", "Move Alpha down");
    });
  });

  test.describe("putting channels in a group", () => {
    test("ticking a channel moves it into the selected group, in the dialog and the sidebar", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByLabel("FixtureStreak").check();

      await expect(groupButton(dialog, "Zebra Squad")).toContainText("1", { timeout: 2_000 });
      await expect(groupButton(dialog, "Ungrouped")).toContainText("2");
      await twitchPage.keyboard.press("Escape");

      const sidebar = twitchPage.locator("#__root");
      await sidebar.getByRole("button", { name: /Zebra Squad/ }).click();
      await expect(sidebar.getByText("FixtureStreak").first()).toBeVisible();
    });

    test("unticking sends it back to Ungrouped", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByLabel("FixtureStreak").check();
      await expect(groupButton(dialog, "Zebra Squad")).toContainText("1");
      await dialog.getByLabel("FixtureStreak").uncheck();
      await expect(groupButton(dialog, "Zebra Squad")).toContainText("0");
      await expect(groupButton(dialog, "Ungrouped")).toContainText("3");
    });

    test("each channel says which group it is in now", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await expect(dialog.getByTestId("channel-group").first()).toContainText("Ungrouped");
      await dialog.getByLabel("FixtureStreak").check();
      await expect(dialog.getByRole("listitem").filter({ hasText: "FixtureStreak" }).getByTestId("channel-group")).toContainText("Zebra Squad");
    });

    test("search narrows the channel list", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByPlaceholder("Search channels").fill("streak");
      await expect(dialog.getByLabel("FixtureStreak")).toBeVisible();
      await expect(dialog.getByLabel("Fixture_Live")).toHaveCount(0);
      await dialog.getByPlaceholder("Search channels").fill("");
      await expect(dialog.getByLabel("Fixture_Live")).toBeVisible();
    });

    test("the selected group's channels come first when the group is opened", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByLabel("FixtureStreak").check();
      await groupButton(dialog, "Ungrouped").click();
      await groupButton(dialog, "Zebra Squad").click();

      const names = await dialog.getByRole("list", { name: "Channels" }).getByRole("listitem").locator("label").allInnerTexts();
      expect(names[0].trim()).toBe("FixtureStreak"); // a member, ahead of the other two, which stay alphabetical
      expect(names.slice(1).map((n) => n.trim())).toEqual(["Fixture_Live", "fixture_offline"]);
    });

    test("ticking a channel does not move its row while you are still choosing", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      const order = () => dialog.getByRole("list", { name: "Channels" }).getByRole("listitem").locator("label").allInnerTexts();
      const before = await order();
      expect(before).toHaveLength(3);
      await dialog.getByLabel("fixture_offline").check();
      await expect(groupButton(dialog, "Zebra Squad")).toContainText("1");
      expect(await order()).toEqual(before);
    });

    test("with nothing in the group yet, channels stay in alphabetical order", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      const names = (await dialog.getByRole("list", { name: "Channels" }).getByRole("listitem").locator("label").allInnerTexts()).map((n) => n.trim());
      expect(names).toHaveLength(3);
      expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    });

    test("searching with no match says so", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByPlaceholder("Search channels").fill("zzzzzz");
      await expect(dialog).toContainText("No channels match");
    });

    test("the default group lists its channels without checkboxes and points to the other groups", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await expect(dialog.locator("input[type=checkbox]")).toHaveCount(0);
      await expect(dialog).toContainText("Select another group to move channels into it");
    });
  });

  test.describe("renaming and deleting", () => {
    test("renaming keeps the channels and updates the sidebar", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByLabel("FixtureStreak").check();

      await dialog.getByRole("button", { name: "edit-group-name" }).click();
      await dialog.getByPlaceholder("Updated Name").fill("Quagga Crew");
      await dialog.getByRole("button", { name: "save-group-name" }).click();

      await expect(groupButton(dialog, "Quagga Crew")).toContainText("1");
      await expect(dialog).not.toContainText("Zebra Squad");
      await expect(dialog.getByRole("heading", { name: "Quagga Crew" })).toBeVisible();
      await twitchPage.keyboard.press("Escape");

      const sidebar = twitchPage.locator("#__root");
      await expect(sidebar).not.toContainText("Zebra Squad");
      await sidebar.getByRole("button", { name: /Quagga Crew/ }).click();
      await expect(sidebar.getByText("FixtureStreak").first()).toBeVisible();
    });

    test("a group can be renamed to a different capitalisation of its own name", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "zebra squad");
      await dialog.getByRole("button", { name: "edit-group-name" }).click();
      await dialog.getByPlaceholder("Updated Name").fill("Zebra Squad");
      await expect(dialog).not.toContainText("already exists");
      await dialog.getByRole("button", { name: "save-group-name" }).click();

      await expect(dialog.getByRole("heading", { name: "Zebra Squad", exact: true })).toBeVisible();
      await expect(dialog.getByText("zebra squad", { exact: true })).toHaveCount(0);
    });

    test("a group cannot be renamed to another group's name", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Alpha");
      await addGroup(dialog, "Beta");
      await dialog.getByRole("button", { name: "edit-group-name" }).click();
      await dialog.getByPlaceholder("Updated Name").fill("alpha");
      await expect(dialog).toContainText("Group name already exists");
      await expect(dialog.getByRole("button", { name: "save-group-name" })).toBeDisabled();
    });

    test("renaming can be cancelled", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByRole("button", { name: "edit-group-name" }).click();
      await dialog.getByPlaceholder("Updated Name").fill("Something else");
      await dialog.getByRole("button", { name: "cancel-rename" }).click();
      await expect(dialog.getByPlaceholder("Updated Name")).toHaveCount(0);
      await expect(dialog.getByRole("heading", { name: "Zebra Squad" })).toBeVisible();
    });

    test("deleting a group sends its channels back to Ungrouped", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByLabel("FixtureStreak").check();
      await expect(groupButton(dialog, "Ungrouped")).toContainText("2");

      await dialog.getByRole("button", { name: "delete-group" }).click();
      await dialog.getByRole("button", { name: "Are you sure?" }).click();

      await expect(dialog).not.toContainText("Zebra Squad");
      await expect(groupButton(dialog, "Ungrouped")).toContainText("3");
      await expect(groupButton(dialog, "Ungrouped")).toHaveAttribute("aria-pressed", "true");
      await twitchPage.keyboard.press("Escape");
      await expect(twitchPage.locator("#__root")).not.toContainText("Zebra Squad");
    });

    test("deleting needs a second click", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Zebra Squad");
      await dialog.getByRole("button", { name: "delete-group" }).click();
      await expect(dialog.getByRole("button", { name: "Are you sure?" })).toBeVisible();
      await expect(groupButton(dialog, "Zebra Squad")).toBeVisible();
    });

    test("the default group can be renamed but not deleted", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await expect(dialog).toContainText("default group");
      await expect(dialog.getByRole("button", { name: "edit-group-name" })).toHaveCount(1);
      await expect(dialog.getByRole("button", { name: "delete-group" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Make default" })).toHaveCount(0);
    });

    test("renaming the default group keeps its channels and it stays the default", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await dialog.getByRole("button", { name: "edit-group-name" }).click();
      await dialog.getByLabel("New group name").fill("Inbox");
      await dialog.getByRole("button", { name: "save-group-name" }).click();
      await expect(groupButton(dialog, "Inbox")).toContainText("Default");
      await expect(groupButton(dialog, "Inbox")).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.getByRole("list", { name: "Groups" })).not.toContainText("Ungrouped");
      await expect(dialog.getByTestId("channel-name")).not.toHaveCount(0);
      await twitchPage.keyboard.press("Escape");
      await expect(twitchPage.locator("#__root")).toContainText("Inbox", { timeout: 5_000 });
    });

    test("another group can be made the default, and the old default then becomes an ordinary group", async ({ twitchPage }) => {
      const dialog = await open(twitchPage);
      await addGroup(dialog, "Alpha");
      await dialog.getByRole("button", { name: "Make default" }).click();
      await expect(groupButton(dialog, "Alpha")).toContainText("Default");
      await expect(groupButton(dialog, "Ungrouped")).not.toContainText("Default");
      // The old default keeps its channels and can now be deleted: they move to the new default
      await groupButton(dialog, "Ungrouped").click();
      await expect(dialog.getByRole("button", { name: "delete-group" })).toBeVisible();
      const members = dialog.locator("input[type=checkbox]:checked");
      await expect(members).not.toHaveCount(0);
      const channels = await members.count();
      await dialog.getByRole("button", { name: "delete-group" }).click();
      await dialog.getByRole("button", { name: "Are you sure?" }).click();
      await expect(dialog.getByRole("list", { name: "Groups" })).not.toContainText("Ungrouped");
      await expect(groupButton(dialog, "Alpha")).toHaveAttribute("aria-pressed", "true");
      await expect(groupButton(dialog, "Alpha")).toContainText(String(channels));
    });
  });
});
