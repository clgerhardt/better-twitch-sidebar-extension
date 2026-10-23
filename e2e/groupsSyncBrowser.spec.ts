import { test, expect } from "./extension";
import { canonicalize, hashState } from "../src/pages/shared/groupsSync/groupsState";
import { encodeState, metaKey } from "../src/pages/shared/groupsSync/remoteFormat";

// chrome.storage.sync is a local store in this test browser (it is not signed in to Google), which is
// enough to see what the extension writes and to play the part of another device

const syncItems = (worker: import("@playwright/test").Worker) => worker.evaluate(() => chrome.storage.sync.get(null));

test("a group added in the dialog reaches chrome.storage.sync", async ({ twitchPage, worker }) => {
  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await dialog.getByPlaceholder("Add group").fill("Synced Group");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await expect.poll(async () => JSON.stringify(await syncItems(worker)), { timeout: 15_000 }).toContain("Synced Group");
  const items = await syncItems(worker);
  expect(items[metaKey("999")]).toMatchObject({ v: 1, rev: 1, chunks: expect.any(Number) });
  expect((items[metaKey("999")] as { hash: string }).hash).toMatch(/^[0-9a-f]{64}$/);
});

test("groups another device synced show up in the sidebar", async ({ twitchPage, worker }) => {
  const state = canonicalize({ groupNames: ["From Laptop"], channelGroups: { fixture_live: "From Laptop" }, groupColors: { "From Laptop": "#ef4444" } });
  const encoded = encodeState("999", state, 5, "laptop", await hashState(state));
  await worker.evaluate((items) => chrome.storage.sync.set(items), { ...encoded.items, [metaKey("999")]: encoded.meta });

  const header = twitchPage.locator("#__root [data-accordion-component=AccordionItemButton]").filter({ hasText: "From Laptop" });
  await expect(header).toHaveCount(1, { timeout: 15_000 });
  expect(await header.evaluate((el) => getComputedStyle(el).borderLeftColor)).toBe("rgb(239, 68, 68)");
  await expect(header.getByTestId("group-live-count")).toHaveText("1");
});

test("with the popup switch off, nothing is written to sync", async ({ twitchPage, worker, context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  const toggle = popup.getByRole("switch", { name: "Sync groups across devices" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true"); // on by default
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await twitchPage.getByRole("button", { name: "Manage Groups" }).click();
  const dialog = twitchPage.getByRole("dialog");
  await dialog.getByPlaceholder("Add group").fill("Private Group");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByRole("list", { name: "Groups" })).toContainText("Private Group");
  await twitchPage.waitForTimeout(5_000);
  expect(JSON.stringify(await syncItems(worker))).not.toContain("Private Group");

  // Turning it back on shares what is there
  await toggle.click();
  await expect.poll(async () => JSON.stringify(await syncItems(worker)), { timeout: 15_000 }).toContain("Private Group");
});

const header = (page: import("@playwright/test").Page) => page.locator("#__root [data-accordion-component=AccordionItemButton]");

test("the first sync after a login marks this device ready", async ({ twitchPage, worker }) => {
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("groupsSyncReady")).groupsSyncReady), { timeout: 10_000 }).toBe("999");
  await expect(header(twitchPage).first()).toBeVisible();
});

test("until the first sync has finished the sidebar says so instead of showing groups, then shows them", async ({ twitchPage, worker }) => {
  await worker.evaluate(() => chrome.storage.local.remove("groupsSyncReady")); // as right after a login
  await twitchPage.reload();
  await expect(twitchPage.locator("#__root")).toContainText("Syncing your groups...");
  await expect(header(twitchPage)).toHaveCount(0);
  await expect(twitchPage.getByRole("button", { name: "Manage Groups" })).toHaveCount(0);

  await worker.evaluate(() => chrome.storage.local.set({ groupsSyncReady: "999" })); // the sync has finished
  await expect(header(twitchPage).first()).toBeVisible({ timeout: 5_000 });
  await expect(twitchPage.getByRole("button", { name: "Manage Groups" })).toBeVisible();
});

test("a first sync that never finishes does not keep the sidebar waiting for more than a few seconds", async ({ twitchPage, worker }) => {
  await worker.evaluate(() => chrome.storage.local.remove("groupsSyncReady"));
  await twitchPage.reload();
  await expect(twitchPage.locator("#__root")).toContainText("Syncing your groups...");
  await expect(header(twitchPage).first()).toBeVisible({ timeout: 12_000 });
});

test("with syncing switched off the sidebar does not wait", async ({ twitchPage, worker }) => {
  await worker.evaluate(async () => {
    const { globalState } = await chrome.storage.local.get("globalState");
    await chrome.storage.local.set({ globalState: { ...globalState, syncGroups: false } });
    await chrome.storage.local.remove("groupsSyncReady");
  });
  await twitchPage.reload();
  await expect(header(twitchPage).first()).toBeVisible({ timeout: 4_000 });
  await expect(twitchPage.locator("#__root")).not.toContainText("Syncing your groups...");
});

test("logging out clears the marker, so the next login waits for its first sync again", async ({ twitchPage, worker }) => {
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get("groupsSyncReady")).groupsSyncReady), { timeout: 10_000 }).toBe("999");
  const popup = await twitchPage.context().newPage();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/src/pages/popup/index.html`);
  await popup.getByRole("button", { name: "Logout" }).click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get(["groupsSyncReady", "twitchUserId"])).twitchUserId ?? null), { timeout: 10_000 }).toBeNull();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get("groupsSyncReady")).groupsSyncReady)).toBeUndefined();
});

test("the popup says that syncing goes through Chrome sync, tied to the switch", async ({ twitchPage, context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  const toggle = popup.getByRole("switch", { name: "Sync groups across devices" });
  await expect(toggle).toBeVisible();
  await expect(popup.getByText("Uses Chrome sync: sign in to Chrome with Extensions sync on.")).toBeVisible();
  await expect(toggle).toHaveAccessibleDescription(/Uses Chrome sync/);
});
