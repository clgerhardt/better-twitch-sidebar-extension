// Observer and related functions

import { constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";

export const createMutationObserver = (port: chrome.runtime.Port, globalS: any, setFollowersDOMNode: (node: HTMLElement) => void) => {
  return new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      // if (mutation.type === "childList" && mutation.addedNodes.length === 1) {
      //   const addedNode = mutation.addedNodes[0] as HTMLElement;
      //   if (addedNode.ariaLabel === "Followed Channels") {
      //     setFollowersDOMNode(addedNode);
      //     // if (globalS.loggedIn) {
      //     //   hideFollowedChannelsSideNav(addedNode);
      //     // }
      //     messageLogger(constants.location.OBSERVER, "Followed Channels Node Added", addedNode);
      //     port.postMessage({ message: "SYS:Followers:FOLLOWED_CHANNELS_LOADED" });
      //   }
      // }
      if (mutation.type === "attributes" && mutation.attributeName === "aria-label") {
        const expandedSidebarBtn = mutation.target as HTMLElement;
        if (expandedSidebarBtn.ariaLabel === "Expand Side Nav") {
          port.postMessage({ message: "SYS:Followers:EXPANDED_SIDEBAR" });
        } else if (expandedSidebarBtn.ariaLabel === "Collapse Side Nav") {
          port.postMessage({ message: "SYS:Followers:COLLAPSED_SIDEBAR" });
        }
      }
    }
  });
};

export const createChannelCardObserver = (port: chrome.runtime.Port) => {
  return new MutationObserver((mutationsList) => {
    messageLogger(constants.location.OBSERVER, "Channel Card MutationList", mutationsList);
    for (const mutation of mutationsList) {
      messageLogger(constants.location.OBSERVER, "Channel Card Mutation", mutation);
      if(mutation.type === "attributes") {
        const channelCard = (mutation.target) as Element;
        const imageNode = channelCard.querySelector("img");
        const liveStatus = channelCard.querySelectorAll('[data-a-target="side-nav-live-status"] p');
        const offlineStatus = channelCard.querySelector('[data-a-target="side-nav-live-status"] span');
        const channelName = channelCard.querySelector('[data-a-target="side-nav-title"] p');

        messageLogger(constants.location.OBSERVER, "Channel Card Mutation", {
          channelCard,
          imageNode,
          liveStatus,
          offlineStatus,
        });

        if(liveStatus.length > 0 && offlineStatus) {
          messageLogger(constants.location.CONTENT_SCRIPT, "Channel Card Mutation", {
            channelCard,
            imageNode,
            liveStatus,
            offlineStatus,
          });
          port.postMessage({
            message: "SYS:Followers:CHANNEL_CARD_UPDATED",
            channelData: {
              channelName: channelName?.innerHTML ?? "",
              channelLink: `https://twitch.tv${channelCard.getAttribute("href")}`,
              channelImage: imageNode?.src ?? "",
              isLive: liveStatus.length > 0,
              viewerCount: liveStatus.length > 0 ? liveStatus[1].innerHTML : "",
              streamingContent:
                (liveStatus.length > 0
                  ? channelCard?.querySelector('[data-a-target="side-nav-game-title"] p')
                      ?.innerHTML
                  : "") ?? "",
              expandedHTML: channelCard.innerHTML,
            }
          });
        }
      }

    }
  });
}
