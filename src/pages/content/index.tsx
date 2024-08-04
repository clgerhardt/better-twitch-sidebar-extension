import { createRoot } from "react-dom/client";
import "./style.css";
import "react-accessible-accordion/dist/fancy-example.css";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";
import AccordianChannels from "./components/accordian-channels/AccordianChannels";
import ManageGroups from "./components/manage-groups-cta/ManageGroupsCta";
import { followersListParser } from "../utils/parser";
import { getLocalStorage, setLocalStorage } from "../background/storage";
import { getElementBySelector, createElement, insertBefore } from './utils/domUtils';
import { createMutationObserver } from './observer';

const port = chrome.runtime.connect({ name: "content-script" });
let followersDOMNode: any;

const setFollowersDOMNode = (node: any) => {
  messageLogger(constants.location.CONTENT_SCRIPT, "Setting followersDOMNode", node);
  followersDOMNode = node;
};

const observer = createMutationObserver(port, setFollowersDOMNode);

const waitUntil = async () => {
  messageLogger(constants.location.CONTENT_SCRIPT, "Entering waitUntil function");
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const showMoreBtn = getElementBySelector('[data-a-target="side-nav-show-more-button"]');
      if (showMoreBtn) {
        showMoreBtn.click();
      } else {
        messageLogger(constants.location.CONTENT_SCRIPT, "Show more button not found, resolving waitUntil");
        resolve(true);
        clearInterval(interval);
      }
    }, 10);
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

    await waitUntil();

    const followerCards = followersDOMNode.querySelectorAll("[data-a-id]");
    const followerData = followersListParser(followerCards);

    if (hadToExpandSideBar) {
      expandBtn.click();
    }

    port.postMessage({
      message: "SYS:Followers:FOLLOWED_CHANNELS_PARSED",
      data: followerData,
    });

    messageLogger(constants.location.CONTENT_SCRIPT, "Exiting parseFollowersHTML function");
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
    const manageGroupsContainer = getElementBySelector("#__manage-groups-root") || createElement("__manage-groups-root", { height: "3.5rem" });

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

port.onMessage.addListener(async (response) => {
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

try {
  messageLogger(constants.location.CONTENT_SCRIPT, "Content script loaded");
  observer.observe(document.body, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });

  const isDark = getElementBySelector(".tw-root--theme-dark");
  if (isDark) {
    messageLogger(constants.location.CONTENT_SCRIPT, "Dark mode detected");
    isDark.classList.add("dark");
  }
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "Error in content script initialization", e);
}
