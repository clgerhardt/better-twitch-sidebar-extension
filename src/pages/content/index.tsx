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

const port = chrome.runtime.connect({ name: "content-script" });
let followersDOMNode: HTMLElement;
let expandedSidebarBtnState: boolean = false;

var observer = new MutationObserver((mutationsList) => {
  for (var mutation of mutationsList) {
    // console.log(mutation);
    if (mutation.type === "childList" && mutation.addedNodes.length === 1) {
      let addedNode = mutation.addedNodes[0] as HTMLElement;
      if (addedNode.ariaLabel === "Followed Channels") {
        // console.log(mutation);
        followersDOMNode = mutation.addedNodes[0] as HTMLElement;
        hideFollowedChannelsSideNav(mutation.addedNodes[0]);
        port.postMessage({ message: "SYS:Followers:FOLLOWED_CHANNELS_LOADED" });
      }
    }
    // aria-label="Collapse Side Nav"
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "aria-label"
    ) {
      console.log("mutation", mutation)
      let expandedSidebarBtn = mutation.target as HTMLElement;
      if(expandedSidebarBtn.ariaLabel === "Expand Side Nav") {
        expandedSidebarBtnState = true;
      } else {
        // console.log("mutation expanded", mutation)
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
      let showMoreBtn = document.querySelector('[data-a-target="side-nav-show-more-button"]');
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
  let expandBtn = document.querySelector('[data-a-target="side-nav-arrow"]');
  let hadToExpandSideBar = false;
  if (expandBtn?.ariaLabel === "Expand Side Nav") {
    (expandBtn as HTMLElement).click();
    hadToExpandSideBar = true;
  }

  const clickingShowMore = await waitUntil();
  if (clickingShowMore) {
    console.log("clicking show more is done");
  }

  let followerCards = followersDOMNode.querySelectorAll("[data-a-id]");
  let followerData: any = [];

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
  console.log("contentScripts - followersData", followerData);
  port.postMessage({
    message: "SYS:Followers:FOLLOWED_CHANNELS_PARSED",
    data: followerData,
    // sideBarIsExpanded: !hadToExpandSideBar
  });
};

const renderToUI = () => {
  const data = getFromLocal();
  const recommendedFollowers = document.querySelector(
    '[aria-label="Recommended Channels"]'
  ) as HTMLElement;
  const parentDiv = recommendedFollowers.parentNode;
  let rootFound = document.querySelector("#__root") as HTMLElement;
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
    console.log("channelLink", channelLink);
    document.location = channelLink;
  };
  root.render(
    <div className="overflow-y-auto" style={{ height: "60vh" }}>
      <Accordion allowZeroExpanded>
        {Object.keys(data)?.map((group: string) => (
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
            <AccordionItemPanel className="p-1">
              <div data-testid="group-container" className="m-2">
                <ul role="list" className="divide-y divide-gray-100 p-2">
                  {data[group].items.map((channel: any) => (
                    <div className="has-tooltip">
                      <div className="py-0.5 hover:bg-slate-500 cursor-pointer" onClick={() => handleChannelClick(channel.channelLink)} dangerouslySetInnerHTML={{__html: `<div class=\"flex\">${channel.expandedHTML}</div>`}}/>
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

function storeInLocal(data: any) {
    window.localStorage.setItem('betterTwitchSidebar', JSON.stringify(data));
    port.postMessage({message: "SYS:Followers:STORED_IN_LOCAL"});
}

const getFromLocal = () => {
  const betterTwitchSidebarData = window.localStorage.getItem(
    "betterTwitchSidebar"
  );
  return betterTwitchSidebarData != "undefined"
    ? JSON.parse(betterTwitchSidebarData ?? "")
    : null;
};

port.onMessage.addListener((response) => {
  console.log("content script - posted message: ", response);
  switch (response.message) {
    case "SYS:Followers:PARSE_FOLLOWED_CHANNELS_HTML":
      parseFollowersHTML();
      break;
    case "SYS:Followers:STORE_IN_LOCAL":
      storeInLocal(response.data)
      // window.localStorage.setItem('betterTwitchSidebar', JSON.stringify(response.data));
      // port.postMessage({ message: "SYS:Followers:STORED_IN_LOCAL" });
      break;
    case "SYS:UI:RenderFollowersInSideBar":
      renderToUI();
      break;
    default:
    // console.log("no action found");
  }
});

try {
  console.log("TESTING - content script loaded");
} catch (e) {
  console.error(e);
}
