import { GlobalState } from "../models/GlobalState";
import { SIDEBAR_STATE_KEY, constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";

import {
  attachStorageListener,
  getLocalStorage,
  setLocalStorage,
} from "./storage";
import { getGlobalState, updateSidebarState } from "./utils";

messageLogger(constants.location.BACKGROUND, "background script loaded");
attachStorageListener();

chrome.runtime.onInstalled.addListener(async () => {
  messageLogger(
    constants.location.BACKGROUND,
    "I just installed my chrome extension"
  );

  try {
    await setLocalStorage(
      constants.storage.globalState,
      {
        loggedIn: false,
        followersListInitialized: false,
        showDefaultSidebar: false,
        initializationDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      } as GlobalState
    );
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
        "posted message",
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
        messageLogger(constants.location.BACKGROUND, "Error in port message handling", error);
      }
    });
  }

  port.onDisconnect.addListener(() => {
    messageLogger(constants.location.BACKGROUND, "Disconnected: ", port);
  });
});
