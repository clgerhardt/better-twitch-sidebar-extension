import { createRoot } from "react-dom/client";
import "./style.css";
import "react-accessible-accordion/dist/fancy-example.css";

import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";
import { getLocalStorage } from "../background/storage";
import AccordianChannels from "./components/accordian-channels/AccordianChannels";
import ManageGroups from "./components/manage-groups-cta/ManageGroupsCta";


const port = chrome.runtime.connect({ name: "content-script" });
let followersDOMNode: HTMLElement;
let expandedSidebarBtnState = false;

const observer = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    // messageLogger(constants.location.CONTENT_SCRIPT, "mutation", mutation);
    if (mutation.type === "childList" && mutation.addedNodes.length === 1) {
      const addedNode = mutation.addedNodes[0] as HTMLElement;
      if (addedNode.ariaLabel === "Followed Channels") {
        followersDOMNode = mutation.addedNodes[0] as HTMLElement;
        hideFollowedChannelsSideNav(mutation.addedNodes[0]);
        port.postMessage({ message: "SYS:Followers:FOLLOWED_CHANNELS_LOADED" });
      }
    }
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "aria-label"
    ) {
      const expandedSidebarBtn = mutation.target as HTMLElement;
      if(expandedSidebarBtn.ariaLabel === "Expand Side Nav") {
        expandedSidebarBtnState = true;
      } else {
        expandedSidebarBtnState = false;
      }
      renderToUI();
    }
  }
});
const config = {
  attributes: true,
  childList: true,
  characterData: true,
  subtree: true,
};
// I can't do this because on page load the DOM element doesnt exist yet so the observer doesnt work
// in my current case im watching DOM to see when this element will load.
// var mainFollowerNode = document.querySelector('[aria-label="Followed Channels"]') as HTMLElement;
observer.observe(document.body, config);

const hideFollowedChannelsSideNav = (node: any) => {
  node.classList.remove("dcyYPL");
  node.style.display = "none";
};

async function waitUntil() {
  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      const showMoreBtn = document.querySelector('[data-a-target="side-nav-show-more-button"]');
      if (showMoreBtn) {
        (document.querySelector('[data-a-target="side-nav-show-more-button"]') as HTMLElement).click();
      } else {
        resolve(true);
        clearInterval(interval);
      }
    }, 10);
  });
}

const parseFollowersHTML = async () => {
  const expandBtn = document.querySelector('[data-a-target="side-nav-arrow"]');
  let hadToExpandSideBar = false;
  if (expandBtn?.ariaLabel === "Expand Side Nav") {
    (expandBtn as HTMLElement).click();
    hadToExpandSideBar = true;
  }

  const clickingShowMore = await waitUntil();
  if (clickingShowMore) {
    console.log("clicking show more is done");
  }

  const followerCards = followersDOMNode.querySelectorAll("[data-a-id]");
  const followerData: any = [];

  followerCards.forEach((item: any) => {
    const imageNode = item.querySelector("img");
    const liveStatus = item.querySelectorAll(
      '[data-a-target="side-nav-live-status"] p'
    );
    followerData.push({
      channelName: imageNode?.alt,
      channelLink: `https://twitch.tv${item.getAttribute("href")}`,
      channelImage: imageNode?.src,
      isLive: liveStatus.length > 0,
      viewerCount: liveStatus.length > 0 ? liveStatus[1].innerHTML : "",
      streamingContent:
        liveStatus.length > 0
          ? item?.querySelector('[data-a-target="side-nav-game-title"] p')
              ?.innerHTML
          : "",
      expandedHTML: item.innerHTML
    });
  });
  if (hadToExpandSideBar) {
    (expandBtn as HTMLElement).click();
  }
  messageLogger(constants.location.CONTENT_SCRIPT, "followersData", followerData);
  port.postMessage({
    message: "SYS:Followers:FOLLOWED_CHANNELS_PARSED",
    data: followerData,
  });
};

const renderToUI = async () => {
  const followedChannels = await getLocalStorage(constants.storage.localStorageKey).then((d: any) => {
    return d || {};
  }).catch((e: any) => {
    messageLogger(constants.location.CONTENT_SCRIPT, "error", e);
  });

  const recommendedFollowers = document.querySelector(
    constants.htmlSearchStrings.ARIA_LABEL_RECOMMENDED_CHANNELS
  ) as HTMLElement;
  const parentDiv = recommendedFollowers.parentNode;

  const rootFound = document.querySelector("#__root") as HTMLElement;
  const manageGroupsRootFound = document.querySelector("#__manage-groups-root") as HTMLElement;
  if (!rootFound) {
    const newMainDiv = document.createElement("div");
    newMainDiv.id = "__root";
    parentDiv?.insertBefore(newMainDiv, recommendedFollowers);
  }
  if(!manageGroupsRootFound) {
    const newMainDiv = document.createElement("div");
    newMainDiv.id = "__manage-groups-root";
    newMainDiv.style.height = "3.5rem";
    parentDiv?.insertBefore(newMainDiv, recommendedFollowers);
  }
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Options root element");
  const manageGroupsContainer = document.querySelector("#__manage-groups-root");
  if(!manageGroupsContainer) throw new Error("Can't find Manage Groups root element");

  const root = createRoot(rootContainer);
  const manageGroupsRoot = createRoot(manageGroupsContainer);

  root.render(
    <AccordianChannels expandedSidebarBtnState={expandedSidebarBtnState}/>
  );
  manageGroupsRoot.render(
    <ManageGroups />
  );
};

port.onMessage.addListener((response) => {
  messageLogger(constants.location.CONTENT_SCRIPT, "posted message", response.data);
  switch (response.message) {
    case "SYS:Followers:PARSE_FOLLOWED_CHANNELS_HTML":
      parseFollowersHTML();
      break;
    case "SYS:UI:RenderFollowersInSideBar":
      renderToUI();
      break;
    default:
      messageLogger(constants.location.CONTENT_SCRIPT, "no action found", response)
  }
});

try {
  messageLogger(constants.location.CONTENT_SCRIPT, "content script loaded");
  const isDark = document.querySelector(".tw-root--theme-dark");
  if (isDark) {
    messageLogger(constants.location.CONTENT_SCRIPT, "dark mode detected");
    isDark.classList.add("dark");
  }
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "error", e);
}
