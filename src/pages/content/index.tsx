import { createRoot, Root } from "react-dom/client";
import "./style.css";
import "react-accessible-accordion/dist/fancy-example.css";
import { messageLogger } from "../utils/logger";
import { constants, GLOBAL_STATE_KEY } from "../utils/constants";
import AccordianChannels from "./components/side-navigation/AccordianChannels";
import ManageGroups from "./components/manage-groups-cta/ManageGroupsCta";
import { getLocalStorage } from "../background/storage";
import { getElementBySelector, createElement, insertBefore } from './utils/domUtils';
import { createMutationObserver } from './observer';
import { startPageAccountReporting } from "./pageAccount";

// Global variables
let port: chrome.runtime.Port;
let mainObserver: MutationObserver;
let pageSetupDone = false;
// One React root per container: creating a second root on the same container duplicates the UI
const reactRoots = new WeakMap<Element, Root>();

const getReactRoot = (container: Element) => {
  let root = reactRoots.get(container);
  if (!root) {
    root = createRoot(container);
    reactRoots.set(container, root);
  }
  return root;
};

// Always posts through the current port, since the port is replaced whenever the background restarts
const postToBackground = (message: any) => {
  try {
    port.postMessage(message);
  } catch (error) {
    messageLogger(constants.location.CONTENT_SCRIPT, "Could not post to background", error);
  }
};

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


const RECONNECT_DELAY_MS = 500;

const openPort = () => {
    // After the extension is reloaded or updated this script is orphaned and cannot reconnect
    if (!chrome.runtime?.id) return;
    messageLogger(constants.location.CONTENT_SCRIPT, "Connecting to long-lived port : " + new Date(Date.now()).toLocaleString());
    port = chrome.runtime.connect({ name: "content-script" });

    port.onDisconnect.addListener(() => {
      messageLogger(constants.location.CONTENT_SCRIPT, "Disconnected from background. Attempting to reconnect... : " + new Date(Date.now()).toLocaleString());
      setTimeout(() => {
        openPort();
        // The render request may have been lost with the old port
        if (pageSetupDone && !getElementBySelector("#__root")) {
          postToBackground({ message: constants.portMessages.FOLLOWED_CHANNELS_LOADED });
        }
      }, RECONNECT_DELAY_MS);
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
};

// Runs once per page, not on every reconnect
const setUpPage = async () => {
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
    mainObserver = createMutationObserver(postToBackground);
    mainObserver.observe(document.body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    pageSetupDone = true;
    const initialNode = getElementBySelector("[aria-label='Followed Channels']");
    if (initialNode) {
      messageLogger(constants.location.OBSERVER, "Followed Channels Node already in DOM", initialNode);
      postToBackground({ message: constants.portMessages.FOLLOWED_CHANNELS_LOADED });
    }
};

const connectToBackground = async () => {
    openPort();
    await setUpPage();
};

const renderToUI = async (tabId: any) => {
  messageLogger(constants.location.CONTENT_SCRIPT, "Entering renderToUI function with tabId", tabId);
  try {
    const recommendedFollowers = getElementBySelector(constants.htmlSearchStrings.ARIA_LABEL_RECOMMENDED_CHANNELS);

    const rootContainer = getElementBySelector("#__root") || createElement("__root");
    const manageGroupsContainer = getElementBySelector("#__manage-groups-root") || createElement("__manage-groups-root", { maxheight: "3.5rem" });

    insertBefore(rootContainer, recommendedFollowers);
    insertBefore(manageGroupsContainer, recommendedFollowers);

    getReactRoot(rootContainer).render(<AccordianChannels />);
    getReactRoot(manageGroupsContainer).render(<ManageGroups />);

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
  startPageAccountReporting();
  connectToBackground();
  addMessageListener();
  setInterval(() => {
    if (port) {
      postToBackground({ type: "HEARTBEAT" });
    }
  }, 20_000);
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "Error in content script initialization", e);
}
