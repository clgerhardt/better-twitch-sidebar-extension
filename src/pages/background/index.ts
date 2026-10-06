import { GlobalState } from "../models/GlobalState";
import { SIDEBAR_STATE_KEY, constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";

import {
  attachStorageListener,
  getLocalStorage,
  setLocalStorage,
  clearAllStorage
} from "./storage";
import { getGlobalState, isUserLoggedIn, updateSidebarState } from "./utils";
import { resolveGlobalState, shouldClearStorage } from "./installState";

messageLogger(constants.location.BACKGROUND, "background script loaded");
attachStorageListener();

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
      loggedIn: await isUserLoggedIn(),
      followersListInitialized: false,
      hideOriginalFollowersList: true,
      hideStories: false,
      hideLiveChannels: false,
      initializationDate: isoNow,
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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "content-script") {
    port.onMessage.addListener(async (response) => {
      messageLogger(
        constants.location.BACKGROUND,
        "content script posted message",
        response
      );
      let tabs;

      try {
        switch (response.message) {
          case "SYS:Followers:FOLLOWED_CHANNELS_LOADED":
              messageLogger(constants.location.BACKGROUND, "UI Loaded");
              // eslint-disable-next-line no-case-declarations
              tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tabs.length > 0) {
                const tabId = tabs[0].id?.toString() ?? "";
                if (tabId) {
                  port.postMessage({
                    message: "SYS:Followers:RenderFollowersInSideBar",
                    tabId: tabId,
                  });
                }
              }
              break;
          case "SYS:Followers:EXPANDED_SIDEBAR":
          case "SYS:Followers:COLLAPSED_SIDEBAR":
            // eslint-disable-next-line no-case-declarations
            const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTabs.length > 0) {
              const tabId: any = activeTabs[0].id?.toString() ?? "";
              if (tabId) {
                const sidebarState = response.message === "SYS:Followers:EXPANDED_SIDEBAR" ? false : true;
                await updateSidebarState(tabId, {
                  sidebarExpanded: sidebarState,
                  initialDocStateIdentified: true,
                });
              }
            }
            break;
          default:
            messageLogger(
              constants.location.BACKGROUND,
              "no action found",
              response
            );
        }
      } catch (error) {
        messageLogger(constants.location.BACKGROUND, "Error in content script port message handling", error);
      }
    });
  }

  if (port.name === "popup") {
    port.onMessage.addListener(async (response) => {
      messageLogger(
        constants.location.BACKGROUND,
        "popup posted message",
        response
      );
      try {
        switch (response.message) {
          case "SYS:User:LoggedIn":
            // eslint-disable-next-line no-case-declarations
            messageLogger(constants.location.BACKGROUND, "User logged in", response);
            const storageGlobalState: any = await getGlobalState();
            if (!storageGlobalState.loggedIn) {
              await setLocalStorage(constants.storage.globalState, {
                ...storageGlobalState,
                loggedIn: true,
                lastUpdated: new Date().toISOString(),
              });
            }
            break;
          default:
            messageLogger(
              constants.location.BACKGROUND,
              "no action found for popup message",
              response
            );
        }
      } catch (error) {
        messageLogger(constants.location.BACKGROUND, "Error in popup message handling", error);
      }
    });
  }

  port.onDisconnect.addListener(() => {
    messageLogger(constants.location.BACKGROUND, `Disconnected: ${port.name} at ${new Date(Date.now()).toLocaleString()}`);
  });
});
