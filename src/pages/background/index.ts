import { GlobalState } from "../models/GlobalState";
import { FOLLOWED_CHANNELS_KEY, SIDEBAR_STATE_KEY, constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";

import {
  getLocalStorage,
  setLocalStorage,
  clearAllStorage
} from "./storage";
import { getGlobalState, updateSidebarState } from "./utils";
import { resolveGlobalState, shouldClearStorage } from "./installState";
import { connectTwitch } from "./auth";
import { refreshChannels } from "./refresh";
import { watchAccountSwitch } from "./accountSwitch";
import { MESSAGES } from "../shared/messages";

messageLogger(constants.location.BACKGROUND, "background script loaded");
watchAccountSwitch();

chrome.runtime.onInstalled.addListener(async (details) => {
  messageLogger(
    constants.location.BACKGROUND,
    "onInstalled: " + details.reason
  );

  try {
    if (shouldClearStorage(details.reason)) {
      await clearAllStorage();
    }

    // Older versions kept a copy of the group list here, which could hold a previous account's channels
    await chrome.storage.local.remove(FOLLOWED_CHANNELS_KEY);

    const existing = (await getGlobalState().catch(() => undefined)) as Partial<GlobalState> | undefined;
    const isoNow = new Date().toISOString();
    const defaults: GlobalState = {
      // Set to true when the popup confirms a Twitch user; a fresh install has no token yet
      loggedIn: false,
      hideOriginalFollowersList: true,
      hideStories: false,
      hideLiveChannels: false,
      lastUpdated: isoNow,
    };
    await setLocalStorage(
      constants.storage.globalState,
      resolveGlobalState(details.reason, existing, defaults)
    );

    const sidebarState = await getLocalStorage(SIDEBAR_STATE_KEY).catch(() => undefined);
    if (!sidebarState) {
      await setLocalStorage(SIDEBAR_STATE_KEY, []);
    }
  } catch (error) {
    console.error("Error during onInstalled:", error);
  }
});

// One-shot requests from the popup. Returning true keeps the channel open for the async reply.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === MESSAGES.CONNECT_TWITCH) {
    connectTwitch().then((result) => {
      // Fetch the channels right away, even if no Twitch tab is open to ask for them
      if (result.ok) void refreshChannels(true);
      sendResponse(result);
    });
    return true;
  }
  if (request?.type === MESSAGES.REFRESH_CHANNELS) {
    refreshChannels(request.force === true).then(sendResponse);
    return true;
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const data: any = await getLocalStorage(SIDEBAR_STATE_KEY);
    if (data && data[tabId] !== undefined) {
      delete data[tabId];
      await setLocalStorage(SIDEBAR_STATE_KEY, data);
    }
  } catch (error) {
    console.error("Error during tab removal:", error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.url?.includes("https://twitch.tv")) {
    try {
      const data: any = await getLocalStorage(constants.storage.sideBarStateByTab);
      if (data && data[tabId.toString()] === undefined) {
        const newState = {
          sidebarExpanded: true,
          initialDocStateIdentified: false,
        };
        await updateSidebarState(tabId, newState);
      }
    } catch (error) {
      console.error("Error during tab update:", error);
    }
  }
});
