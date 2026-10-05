import { test, expect } from "./extension";
import { test as unit, expect as unitExpect } from "@playwright/test";
import { resolveGlobalState, shouldClearStorage } from "../src/pages/background/installState";

const defaults = {
  loggedIn: false,
  followersListInitialized: false,
  hideOriginalFollowersList: true,
  hideStories: false,
  hideLiveChannels: false,
  initializationDate: "2026-01-01T00:00:00.000Z",
  lastUpdated: "2026-01-01T00:00:00.000Z",
};

unit.describe("onInstalled state", () => {
  unit("only a fresh install clears storage", () => {
    unitExpect(shouldClearStorage("install")).toBe(true);
    unitExpect(shouldClearStorage("update")).toBe(false);
    unitExpect(shouldClearStorage("chrome_update")).toBe(false);
  });

  unit("an update keeps existing settings and fills in missing defaults", () => {
    const existing = { loggedIn: true, hideOriginalFollowersList: false } as any;
    const state = resolveGlobalState("update", existing, defaults);
    unitExpect(state.loggedIn).toBe(true);
    unitExpect(state.hideOriginalFollowersList).toBe(false);
    unitExpect(state.hideStories).toBe(false);
    unitExpect(state.initializationDate).toBe(defaults.initializationDate);
  });

  unit("an update with no saved state falls back to defaults", () => {
    unitExpect(resolveGlobalState("update", undefined, defaults)).toEqual(defaults);
  });

  unit("a fresh install ignores any leftover state", () => {
    const existing = { loggedIn: true, hideOriginalFollowersList: false } as any;
    unitExpect(resolveGlobalState("install", existing, defaults)).toEqual(defaults);
  });
});

test("a fresh install gets default state", async ({ worker }) => {
  await expect
    .poll(() => worker.evaluate(async () => !!(await chrome.storage.local.get("globalState")).globalState))
    .toBe(true);
  const { globalState } = await worker.evaluate(() => chrome.storage.local.get("globalState"));
  expect(globalState.hideOriginalFollowersList).toBe(true);
  expect(globalState.followersListInitialized).toBe(false);
});
