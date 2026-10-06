import { createRoot } from "react-dom/client";
import "./style.css";
import "react-accessible-accordion/dist/fancy-example.css";
import { messageLogger } from "../utils/logger";
import { constants, GLOBAL_STATE_KEY } from "../utils/constants";
import AccordianChannels from "./components/side-navigation/AccordianChannels";
import ManageGroups from "./components/manage-groups-cta/ManageGroupsCta";
import { getLocalStorage, setLocalStorage } from "../background/storage";
import { getElementBySelector, createElement, insertBefore } from './utils/domUtils';
import { createMutationObserver } from './observer';

// Global variables
let port: chrome.runtime.Port;
let mainObserver: MutationObserver;

const applySidebarVisibilityFromState = (globalState: any) => {
  if (!globalState) return;

  const configs = [
    {
      selector: "[aria-label='Followed Channels']",
      hidden: globalState.hideOriginalFollowersList,
      logMessage: "Applying initial visibility: Followed Channels",
      overrideStyle: false,
    },
    {
      selector: "[aria-label='Live Channels']",
      hidden: globalState.hideLiveChannels,
      logMessage: "Applying initial visibility: Live Channels",
      overrideStyle: false,
    },
    {
      selector: "[class*='storiesLeftNavSection']",
      hidden: globalState.hideStories,
      logMessage: "Applying initial visibility: Stories",
      overrideStyle: true,
    }
  ];

  for (const { selector, hidden, logMessage, overrideStyle } of configs) {
    const element = getElementBySelector(selector);
    if (!element) continue;

    if (hidden && element.classList.contains("iGMbNn")) {
      element.classList.remove("iGMbNn");
      messageLogger(constants.location.CONTENT_SCRIPT, `Removed class iGMbNn from ${selector}`);
    }

    messageLogger(constants.location.CONTENT_SCRIPT, logMessage);

    if (overrideStyle) {
      element.style.setProperty("display", hidden ? "none" : "block", "important");
    } else if (hidden) {
      element.style.setProperty("display", "none", "important");
    } else {
      element.style.removeProperty("display");
    }
  }
};

const waitForSidebarElements = async (selectors: string[], timeoutMs = 5000): Promise<boolean> => {
  const start = performance.now();
  return new Promise(resolve => {
    const check = () => {
      const allFound = selectors.every(sel => !!getElementBySelector(sel));
      if (allFound) return resolve(true);
      if (performance.now() - start > timeoutMs) return resolve(false);
      requestAnimationFrame(check);
    };
    check();
  });
};


const connectToBackground = async () => {
    messageLogger(constants.location.CONTENT_SCRIPT, "Connecting to long-lived port : " + new Date(Date.now()).toLocaleString());
    port = chrome.runtime.connect({ name: "content-script" });

    port.onDisconnect.addListener(() => {
      messageLogger(constants.location.CONTENT_SCRIPT, "Disconnected from background. Attempting to reconnect... : " + new Date(Date.now()).toLocaleString());
      setTimeout(connectToBackground, 1);
    });

    port.onMessage.addListener(async (response: any) => {
      messageLogger(constants.location.CONTENT_SCRIPT, "Received message from port", response);
      try {
        switch (response.message) {
          case "SYS:Followers:RenderFollowersInSideBar":
            await renderToUI(response.tabId);
            break;
          default:
            messageLogger(constants.location.CONTENT_SCRIPT, "No action found for message", response);
        }
      } catch (error) {
        messageLogger(constants.location.CONTENT_SCRIPT, "Error handling port message", error);
      }
    });
    const globalS: any = await getLocalStorage(GLOBAL_STATE_KEY);
    const success = await waitForSidebarElements([
      "[aria-label='Followed Channels']",
      "[aria-label='Live Channels']"
    ]);
    // Stories is optional (not every page or account has it): only give it a short grace period
    await waitForSidebarElements(["[class*='storiesLeftNavSection']"], 1000);

    if (success) {
      applySidebarVisibilityFromState(globalS);
    } else {
      messageLogger(constants.location.CONTENT_SCRIPT, "Sidebar elements not found in time");
    }
    mainObserver = createMutationObserver(port);
    mainObserver.observe(document.body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    const initialNode = getElementBySelector("[aria-label='Followed Channels']");
    if (initialNode) {
      messageLogger(constants.location.OBSERVER, "Followed Channels Node already in DOM", initialNode);
      port.postMessage({ message: "SYS:Followers:FOLLOWED_CHANNELS_LOADED" });
    }
};

const renderToUI = async (tabId: any) => {
  messageLogger(constants.location.CONTENT_SCRIPT, "Entering renderToUI function with tabId", tabId);
  try {
    const sideNavBtn = getElementBySelector('[data-a-target="side-nav-arrow"]');
    const ariaLabel = sideNavBtn?.getAttribute("aria-label");
    const currentState = ariaLabel === "Expand Side Nav" ? false : true;

    const data: any = await getLocalStorage(constants.storage.prefix + constants.storage.sideBarStateByTab);
    await setLocalStorage(constants.storage.prefix + constants.storage.sideBarStateByTab, {
      ...data,
      [tabId]: {
        sidebarExpanded: currentState,
        initialDocStateIdentified: true,
      },
    });

    const recommendedFollowers = getElementBySelector(constants.htmlSearchStrings.ARIA_LABEL_RECOMMENDED_CHANNELS);

    const rootContainer = getElementBySelector("#__root") || createElement("__root");
    const manageGroupsContainer = getElementBySelector("#__manage-groups-root") || createElement("__manage-groups-root", { maxheight: "3.5rem" });

    insertBefore(rootContainer, recommendedFollowers);
    insertBefore(manageGroupsContainer, recommendedFollowers);

    const root = createRoot(rootContainer);
    const manageGroupsRoot = createRoot(manageGroupsContainer);

    root.render(<AccordianChannels tabId={tabId} />);
    manageGroupsRoot.render(<ManageGroups tabId={tabId} />);

    messageLogger(constants.location.CONTENT_SCRIPT, "Exiting renderToUI function");
  } catch (error) {
    messageLogger(constants.location.CONTENT_SCRIPT, "Error in renderToUI function", error);
  }
};

const addMessageListener = () => {
  chrome.runtime.onMessage.addListener(async (request) => {
    let success = false;

    switch (request.message) {
      case "SYS:Followers:TOGGLE_FOLLOWERS_SIDEBAR":
      case "SYS:Followers:TOGGLE_LIVE_CHANNELS":
      case "SYS:Followers:TOGGLE_STORIES":
        const globalState = await getLocalStorage(GLOBAL_STATE_KEY);
        applySidebarVisibilityFromState(globalState);
        success = true;
        break;
    }

    if (success) {
      messageLogger(constants.location.CONTENT_SCRIPT, "Action successful for message", request.message);
    } else {
      messageLogger(constants.location.CONTENT_SCRIPT, "Action failed for message", request.message);
    }

    return true;
  });
};

try {
  messageLogger(constants.location.CONTENT_SCRIPT, "Content script loaded");
  const isDark = getElementBySelector(".tw-root--theme-dark");
  if (isDark) {
    messageLogger(constants.location.CONTENT_SCRIPT, "Dark mode detected");
    isDark.classList.add("dark");
  }
  connectToBackground();
  addMessageListener();
  setInterval(() => {
    if (port && port.postMessage) {
      port.postMessage({ type: "HEARTBEAT" });
    }
  }, 20_000);
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "Error in content script initialization", e);
}
