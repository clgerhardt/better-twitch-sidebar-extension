import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
} from "react-accessible-accordion";
import {
  PlusCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { Group } from "@src/pages/models/Group";
import { Channel } from "@src/pages/models/Channel";
import { messageLogger } from "@src/pages/utils/logger";
import { getLocalStorage } from "@src/pages/background/storage";
import { constants } from "@src/pages/utils/constants";

const AccordianChannels = () => {
  const handleChannelClick = (channelLink: string) => {
    document.location = channelLink;
  };

  const getFollowedChannels = async () => {
    const followedChannels = await getLocalStorage(
      constants.storage.localStorageKey
    )
      .then((d: any) => {
        return d || [];
      })
      .catch((e: any) => {
        // messageLogger(constants.location.CONTENT_SCRIPT, "error", e);
        console.log("no nothing");
      });
    setFollowedChannelsState(followedChannels);
    messageLogger(
      constants.location.UI_COMPONENT,
      "followedChannels",
      followedChannels
    );

    return followedChannels;
  };

  const [followedChannelsState, setFollowedChannelsState] = useState([]);
  const [expandedSidebarBtnState, setExpandedSidebarBtnState] = useState(false);

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
      if(key === constants.storage.localStorageKey) {
        setFollowedChannelsState(newValue);
      }
      if(key === constants.storage.prefix + constants.storage.sideBarState) {
        setExpandedSidebarBtnState(newValue.sidebarExpanded);
      }
    }
  });

  useEffect(() => {
    getFollowedChannels();
  }, []);

  if(followedChannelsState.length === 0) {
    return <div className="text-center">No channels to show</div>
  }

  // const handleDropdownClick = (groupIndex: number) => {
  //   messageLogger("UI_COMPONENT", "handleDropdownClick", groupIndex);
  //   followedChannelsState[groupIndex].dropdownVisible = !followedChannelsState[groupIndex].dropdownVisible;
  //   messageLogger("UI_COMPONENT", "handleDropdownClick", followedChannelsState);
  //   setFollowedChannelsState(followedChannelsState)
  // };
  return (
    <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
      <Accordion allowZeroExpanded>
        {followedChannelsState.map((group: Group, index: number) => (
          <AccordionItem key={group.groupName}>
            <div className="grid grid-cols-3 gap-2 items-center	">
              <div className="col-start-1 col-end-4">
                <AccordionItemHeading
                  id="expanded-side-bar-title"
                  className="text-2xl my-1.5"
                >
                  <AccordionItemButton className="p-4 rounded-3xl text-left w-full cursor-pointer bg-slate-700">
                    {!expandedSidebarBtnState && (
                      <div
                        id="expanded-side-bar-heading"
                        className="grid grid-cols-3 gap-2"
                      >
                        <div className="col-start-1 col-end-4">
                          {group.groupName}
                        </div>
                        <div className="col-end-5">
                          <PlusCircleIcon className="h-10 w-10 text-blue-500" />
                        </div>
                      </div>
                    )}
                    {expandedSidebarBtnState && (
                      <MinusCircleIcon className="h-10 w-10 text-blue-500" />
                    )}
                  </AccordionItemButton>
                </AccordionItemHeading>
              </div>
              {/* <div className="content-center col-end-5">
                <div className="relative inline-block text-left">
                  <div>
                    <button
                      type="button"
                      id={`menu-button-${group.groupName}`}
                      aria-expanded="true"
                      aria-haspopup="true"
                      onClick={() => handleDropdownClick(index)}
                      >
                        <EllipsisVerticalIcon className="h-10 w-10" />
                    </button>
                  </div>
                  {group.dropdownVisible && (
                    <div
                      className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby={`menu-button-${group.groupName}`}
                      tabIndex={-1}
                    >
                      <div className="py-1" role="none">
                        <a
                          href="#"
                          className="text-gray-700 block px-4 py-2 text-sm"
                          role="menuitem"
                          tabIndex={-1}
                          id="menu-item-0"
                        >
                          Account settings
                        </a>
                        <a
                          href="#"
                          className="text-gray-700 block px-4 py-2 text-sm"
                          role="menuitem"
                          tabIndex={-1}
                          id="menu-item-1"
                        >
                          Support
                        </a>
                        <a
                          href="#"
                          className="text-gray-700 block px-4 py-2 text-sm"
                          role="menuitem"
                          tabIndex={-1}
                          id="menu-item-2"
                        >
                          License
                        </a>
                        <form method="POST" action="#" role="none">
                          <button
                            type="submit"
                            className="text-gray-700 block w-full px-4 py-2 text-left text-sm"
                            role="menuitem"
                            tabIndex={-1}
                            id="menu-item-3"
                          >
                            Sign out
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div> */}
            </div>
            <AccordionItemPanel className="p-0 pt-1">
              <div data-testid="group-container">
                <ul role="list" className="divide-y divide-gray-100">
                  {group.followedChannels.map((channel: Channel) => (
                    <div
                      key={channel.channelName}
                      className="has-tooltip hover:bg-custom-twitch-light-gray p-2"
                    >
                      <div
                        className="py-0.5 cursor-pointer"
                        onClick={() => handleChannelClick(channel.channelLink)}
                        dangerouslySetInnerHTML={{
                          __html: `<div class="flex">${channel.expandedHTML}</div>`,
                        }}
                      />
                    </div>
                  ))}
                </ul>
                <span className="mainbody-tooltip translate-x-40 rounded shadow-lg p-1 bg-gray-100 text-red-500">
                  Some Nice Tooltip Text
                </span>
              </div>
            </AccordionItemPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default AccordianChannels;
