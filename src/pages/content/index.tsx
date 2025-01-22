import { createRoot } from "react-dom/client";
import "./style.css";
import "react-accessible-accordion/dist/fancy-example.css";
import { messageLogger } from "../utils/logger";
import { CHANNEL_GROUP_MAP, constants, GLOBAL_STATE_KEY } from "../utils/constants";
import AccordianChannels from "./components/side-navigation/AccordianChannels";
import ManageGroups from "./components/manage-groups-cta/ManageGroupsCta";
import { followersListParser } from "../utils/parser";
import { getLocalStorage, setLocalStorage } from "../background/storage";
import { getElementBySelector, createElement, insertBefore, waitUntilNoMoreShowMoreButton } from './utils/domUtils';
import { createMutationObserver } from './observer';
import { initFollowersData } from "../utils/transformer";

// Global variables
let port: chrome.runtime.Port;
let followersDOMNode: HTMLElement | null = null;
let observer: MutationObserver;

const setFollowersDOMNode = (node: HTMLElement) => {
  messageLogger(constants.location.CONTENT_SCRIPT, "Setting followersDOMNode", node);
  followersDOMNode = node;
};

const connectToBackground = () => {
    messageLogger(constants.location.CONTENT_SCRIPT, "Connecting to long-lived port");
    port = chrome.runtime.connect({ name: "content-script" });

    port.onDisconnect.addListener(() => {
      messageLogger(constants.location.CONTENT_SCRIPT, "Disconnected from background. Attempting to reconnect...");
      setTimeout(connectToBackground, 1000);
    });

    port.onMessage.addListener(async (response: any) => {
      messageLogger(constants.location.CONTENT_SCRIPT, "Received message from port", response);
      try {
        switch (response.message) {
          case "SYS:Followers:PARSE_FOLLOWED_CHANNELS_HTML":
            await parseFollowersHTML();
            break;
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
    observer = createMutationObserver(port, setFollowersDOMNode);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
};

const parseFollowersHTML = async () => {
  messageLogger(constants.location.CONTENT_SCRIPT, "Entering parseFollowersHTML function");
  try {
    const expandBtn = getElementBySelector('[data-a-target="side-nav-arrow"]');
    let hadToExpandSideBar = false;
    if (expandBtn?.ariaLabel === "Expand Side Nav") {
      expandBtn.click();
      hadToExpandSideBar = true;
    }

    await waitUntilNoMoreShowMoreButton();

    const followerCards = followersDOMNode?.querySelectorAll("[data-a-id]");
    const followerData = followerCards ? followersListParser(followerCards) : [];

    if (hadToExpandSideBar) {
      expandBtn.click();
    }

    messageLogger(constants.location.CONTENT_SCRIPT, "Exiting parseFollowersHTML function");
    return followerData;

  } catch (error) {
    messageLogger(constants.location.CONTENT_SCRIPT, "Error in parseFollowersHTML function", error);
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
    const parentDiv = recommendedFollowers.parentNode;

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

const addFollowersInitializeListener = () => {
  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.message === "SYS:Followers:INITALIZE_FOLLOWED_CHANNELS_FROM_HTML") {
      messageLogger(constants.location.CONTENT_SCRIPT, "Initializing followed channels from HTML");
      const followedData = await parseFollowersHTML();
      const { groupsList, channelGroupMap } = initFollowersData(followedData);
      messageLogger(constants.location.CONTENT_SCRIPT, "Followed channels initialized", groupsList);
      messageLogger(constants.location.CONTENT_SCRIPT, "Channel group map initialized", channelGroupMap);
      await setLocalStorage(
        constants.storage.localStorageKey,
        groupsList
      );
      await setLocalStorage(
        CHANNEL_GROUP_MAP,
        channelGroupMap
      );
      const globalS: any = await getLocalStorage(GLOBAL_STATE_KEY)
      await setLocalStorage(GLOBAL_STATE_KEY, { ...globalS, followersListInitialized: true, initializationDate: new Date().toISOString() });
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
  addFollowersInitializeListener();
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "Error in content script initialization", e);
}
