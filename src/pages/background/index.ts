import { GlobalState } from "../models/GlobalState";
import { LEGACY_STORAGE_KEYS, constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";

import {
  setLocalStorage,
  clearAllStorage
} from "./storage";
import { getGlobalState } from "./utils";
import { resolveGlobalState, shouldClearStorage } from "./installState";
import { connectTwitch } from "./auth";
import { refreshChannels } from "./refresh";
import { watchAccountSwitch } from "./accountSwitch";
import { MESSAGES } from "../shared/messages";

messageLogger(constants.location.BACKGROUND, "background script loaded");
watchAccountSwitch();
// Data older versions left behind (a copy of the group list that could hold a previous account's
// channels, and per-tab sidebar state). Cheap, so it runs every time the worker starts.
void chrome.storage.local.remove(LEGACY_STORAGE_KEYS);

chrome.runtime.onInstalled.addListener(async (details) => {
  messageLogger(
    constants.location.BACKGROUND,
    "onInstalled: " + details.reason
  );

  try {
    if (shouldClearStorage(details.reason)) {
      await clearAllStorage();
    }

    const existing = (await getGlobalState().catch(() => undefined)) as Partial<GlobalState> | undefined;
    const isoNow = new Date().toISOString();
    const defaults: GlobalState = {
      // Set to true when the popup confirms a Twitch user; a fresh install has no token yet
      loggedIn: false,
      hideOriginalFollowersList: true,
      hideStories: false,
      hideLiveChannels: false,
      hideStreaks: false,
      hideRecommendedCategories: false,
      hideViewersAlsoWatch: false,
      lastUpdated: isoNow,
    };
    await setLocalStorage(
      constants.storage.globalState,
      resolveGlobalState(details.reason, existing, defaults)
    );
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
