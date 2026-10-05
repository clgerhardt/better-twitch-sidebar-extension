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

messageLogger(constants.location.BACKGROUND, "background script loaded");
attachStorageListener();

chrome.runtime.onInstalled.addListener(async () => {
  messageLogger(
    constants.location.BACKGROUND,
    "I just installed my chrome extension"
  );

  try {
    const success = await clearAllStorage();
    if (success) {
      const loggedIn = await isUserLoggedIn();
      const isoNow   = new Date().toISOString();
      await setLocalStorage(
        constants.storage.globalState,
        {
          loggedIn: loggedIn,
          followersListInitialized: false,
          hideOriginalFollowersList: true,
          hideStories: false,
          hideLiveChannels: false,
          initializationDate: isoNow,
          lastUpdated: isoNow,
        } as GlobalState
      );
    }
    await setLocalStorage(SIDEBAR_STATE_KEY, []);
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
          case "SYS:Followers:INITIALIZE":
            // eslint-disable-next-line no-case-declarations
            const storageGlobalState: any = await getGlobalState();
            messageLogger(constants.location.BACKGROUND,
              "Attempting to Initialize Followers List",
              response);
            if (!storageGlobalState.followersListInitialized) {
              tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              chrome.tabs.sendMessage(tabs[0].id ?? 0, { message: "SYS:Followers:INITALIZE_FOLLOWED_CHANNELS_FROM_HTML" });
            }
            break;
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
          case "SYS:Followers:CHANNEL_CARD_UPDATED":
            messageLogger(constants.location.BACKGROUND, "CHANNEL_CARD_UPDATED", response);
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
