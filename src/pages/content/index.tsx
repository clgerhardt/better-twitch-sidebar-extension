import { createRoot, Root } from "react-dom/client";
import "./style.css";
import { messageLogger } from "../utils/logger";
import { constants, GLOBAL_STATE_KEY } from "../utils/constants";
import AccordianChannels from "./components/side-navigation/AccordianChannels";
import ManageGroups from "./components/manage-groups-cta/ManageGroupsCta";
import { getLocalStorage } from "../background/storage";
import { getElementBySelector, createElement, insertBefore } from './utils/domUtils';
import {
  findFollowedSection,
  findLiveSection,
  findMountAnchor,
  findRecommendedCategoriesSection,
  findStoriesSection,
  findStreaksSection,
  findViewersAlsoWatchSection,
} from './twitchSections';
import { startPageAccountReporting } from "./pageAccount";
import { getDirection, initI18n, onLanguageChange } from "../shared/i18n/store";
import { watchFollowClicks } from "./followWatcher";

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

// The latest saved settings, so sections Twitch renders later (e.g. "Viewers Also Watch" after a
// page change) are hidden too
let currentGlobalState: any;

const applySidebarVisibilityFromState = (globalState: any) => {
  if (!globalState) return;
  currentGlobalState = globalState;

  const configs = [
    {
      find: findFollowedSection,
      hidden: globalState.hideOriginalFollowersList,
      logMessage: "Applying initial visibility: Followed Channels",
      overrideStyle: false,
    },
    {
      find: findLiveSection,
      hidden: globalState.hideLiveChannels,
      logMessage: "Applying initial visibility: Live Channels",
      overrideStyle: false,
    },
    {
      find: findStoriesSection,
      hidden: globalState.hideStories,
      logMessage: "Applying initial visibility: Stories",
      overrideStyle: true,
    },
    {
      find: findStreaksSection,
      hidden: globalState.hideStreaks,
      logMessage: "Applying initial visibility: Streaks",
      overrideStyle: false,
    },
    {
      find: findRecommendedCategoriesSection,
      hidden: globalState.hideRecommendedCategories,
      logMessage: "Applying initial visibility: Recommended Categories",
      overrideStyle: false,
    },
    {
      // Only on channel pages, so it can appear after the page loads
      find: findViewersAlsoWatchSection,
      hidden: globalState.hideViewersAlsoWatch,
      logMessage: "Applying initial visibility: Viewers Also Watch",
      overrideStyle: false,
    },
  ];

  for (const { find, hidden, logMessage, overrideStyle } of configs) {
    const element = find();
    if (!element) continue;

    if (hidden && element.classList.contains("iGMbNn")) {
      element.classList.remove("iGMbNn");
      messageLogger(constants.location.CONTENT_SCRIPT, `Removed class iGMbNn from ${logMessage}`);
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

const waitForSidebarElements = async (finders: (() => Element | null)[], timeoutMs = 5000): Promise<boolean> => {
  const start = performance.now();
  return new Promise(resolve => {
    const check = () => {
      const allFound = finders.every(find => !!find());
      if (allFound) return resolve(true);
      if (performance.now() - start > timeoutMs) return resolve(false);
      requestAnimationFrame(check);
    };
    check();
  });
};


// The two containers the extension owns. They are created once and kept, so when Twitch drops them
// from the page the same elements go back in and React keeps its state.
let rootContainer: HTMLElement | null = null;
let manageGroupsContainer: HTMLElement | null = null;

// Puts the sidebar groups and the Manage Groups button in front of Twitch's live channels section.
// Safe to call at any time: it does nothing when they are already in place.
const mountSidebar = () => {
  const followed = findFollowedSection();
  const anchor = findMountAnchor();
  if (!followed || !anchor) return;

  const firstMount = !rootContainer || !manageGroupsContainer;
  rootContainer ??= createElement("__root");
  manageGroupsContainer ??= createElement("__manage-groups-root", { maxheight: "3.5rem" });

  const inPlace = rootContainer.isConnected && manageGroupsContainer.isConnected && manageGroupsContainer.nextElementSibling === anchor && rootContainer.nextElementSibling === manageGroupsContainer;
  if (!inPlace) {
    insertBefore(rootContainer, anchor);
    insertBefore(manageGroupsContainer, anchor);
  }

  if (firstMount) {
    // Our parts of the page are written in the language's direction, whatever the page around them is
    const applyDirection = () => [rootContainer, manageGroupsContainer].forEach((container) => container && (container.dir = getDirection()));
    applyDirection();
    onLanguageChange(applyDirection);
    getReactRoot(rootContainer).render(<AccordianChannels />);
    getReactRoot(manageGroupsContainer).render(<ManageGroups />);
    messageLogger(constants.location.CONTENT_SCRIPT, "Sidebar mounted");
  }
};

// Twitch re-renders its sidebar from time to time and can drop what we added; check again after the
// page changes (batched, since the page changes constantly)
const keepSidebarMounted = () => {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!chrome.runtime?.id) {
      // After the extension is reloaded or updated this script is orphaned and must stop
      observer.disconnect();
      return;
    }
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      mountSidebar();
      applySidebarVisibilityFromState(currentGlobalState);
    }, 50);
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

const setUpPage = async () => {
    // The language is set before anything is mounted, so the first thing shown is in the right one
    await initI18n("page");
    const globalS: any = await getLocalStorage(GLOBAL_STATE_KEY);
    const success = await waitForSidebarElements([findFollowedSection, findMountAnchor]);
    // Stories is optional (not every page or account has it): only give it a short grace period
    await waitForSidebarElements([findStoriesSection], 1000);

    if (success) {
      applySidebarVisibilityFromState(globalS);
    } else {
      messageLogger(constants.location.CONTENT_SCRIPT, "Sidebar elements not found in time");
    }
    mountSidebar();
    keepSidebarMounted();
};

// The popup only writes the settings; every open Twitch tab applies them from storage
const watchSettings = () => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[GLOBAL_STATE_KEY]) {
      applySidebarVisibilityFromState(changes[GLOBAL_STATE_KEY].newValue);
    }
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
  setUpPage();
  watchSettings();
  watchFollowClicks();
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "Error in content script initialization", e);
}
