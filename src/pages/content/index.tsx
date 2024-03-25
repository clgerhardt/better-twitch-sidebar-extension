import { createRoot } from "react-dom/client";
import "./style.css";
import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
} from "react-accessible-accordion";
import "react-accessible-accordion/dist/fancy-example.css";
import { PlusCircleIcon, MinusCircleIcon } from "@heroicons/react/24/solid";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";
import { getLocalStorage } from "../background/storage";

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
      viewerCount: liveStatus.length > 0 ? liveStatus[1].innerHTML : null,
      streamingContent:
        liveStatus.length > 0
          ? item?.querySelector('[data-a-target="side-nav-game-title"] p')
              ?.innerHTML
          : null,
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
  if (!rootFound) {
    const newMainDiv = document.createElement("div");
    newMainDiv.id = "__root";
    // data?.default?.items?.forEach((follower: any) => {
    //   let followerDiv = document.createElement("div");
    //   let p = document.createElement("p");
    //   p.classList.add("text-purple-500");
    //   p.innerText = follower.channelName;
    //   followerDiv.appendChild(p);
    //   newMainDiv.appendChild(followerDiv);
    // });
    // let sideNavDiv = document.querySelector(
    //   '[data-test-selector="side-nav"]'
    // ) as HTMLElement;
    // sideNavDiv?.classList.add("peer");
    parentDiv?.insertBefore(newMainDiv, recommendedFollowers);
  }
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Options root element");
  const root = createRoot(rootContainer);

  const handleChannelClick = (channelLink: string) => {
    document.location = channelLink;
  };
  root.render(
    <div className="overflow-y-auto" style={{ height: "60vh" }}>
      <Accordion allowZeroExpanded>
        {Object.keys(followedChannels)?.map((group: string) => (
          <AccordionItem key={group}>
            <AccordionItemHeading
              id="expanded-side-bar-title"
              className="text-2xl mt-3"
            >
              <AccordionItemButton className="p-4 rounded-3xl text-left w-full cursor-pointer bg-slate-700">
                {!expandedSidebarBtnState &&
                <div
                  id="expanded-side-bar-heading"
                  className="grid grid-cols-3 gap-2"
                >
                    <div className="col-start-1 col-end-4">{group}</div>
                    <div className="col-end-5">
                      <PlusCircleIcon className="h-10 w-10 text-blue-500" />
                    </div>
                </div>
                }
                {expandedSidebarBtnState && <MinusCircleIcon className="h-10 w-10 text-blue-500" />}
              </AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel className="p-0 pt-1">
              <div data-testid="group-container">
                <ul role="list" className="divide-y divide-gray-100">
                  {followedChannels[group].items.map((channel: any) => (
                    <div key={channel.channelName} className="has-tooltip hover:bg-custom-twitch-light-gray p-2">
                      <div className="py-0.5 cursor-pointer" onClick={() => handleChannelClick(channel.channelLink)} dangerouslySetInnerHTML={{__html: `<div class="flex">${channel.expandedHTML}</div>`}}/>
                    </div>
                  ))}
                </ul>
                <span className='mainbody-tooltip translate-x-40 rounded shadow-lg p-1 bg-gray-100 text-red-500'>Some Nice Tooltip Text</span>
              </div>
            </AccordionItemPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
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
} catch (e) {
  messageLogger(constants.location.CONTENT_SCRIPT, "error", e);
}
