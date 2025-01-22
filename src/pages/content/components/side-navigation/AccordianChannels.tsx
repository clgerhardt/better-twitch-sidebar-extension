import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
  AccordionItemState,
} from "react-accessible-accordion";
import { useCallback } from "react";
import { Group } from "@src/pages/models/Group";
import { Channel } from "@src/pages/models/Channel";
import useFollowedChannels from "../../hooks/useFollowedChannels";
import useSidebarState from "../../hooks/useSidebarState";
import {
  ChevronDoubleDownIcon,
  ChevronDoubleUpIcon,
} from "@heroicons/react/24/outline";
import useGlobalState from "../../hooks/useGlobalState";
import InitializeFollowerSideContent from "./InitializeFollowerSideContent";

const AccordianChannels = ({ tabId }: { tabId: string }) => {
  const followedChannelsState = useFollowedChannels();
  const isSidebarExpanded = useSidebarState(tabId);
  const globalState = useGlobalState();

  const handleChannelClick = useCallback((channelLink: string) => {
    document.location = channelLink;
  }, []);

  if (followedChannelsState.length === 0) {
    return <div className="text-center">No channels to show</div>;
  }

  return (
    <div>
      {!globalState.followersListInitialized && <InitializeFollowerSideContent globalState={globalState} isSidebarExpanded={isSidebarExpanded} />}
      {globalState.followersListInitialized && <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
        <Accordion allowZeroExpanded>
          {followedChannelsState.map((group: Group) => (
            <AccordionItem key={group.groupName}>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="col-start-1 col-end-4">
                  <AccordionItemHeading
                    id="expanded-side-bar-title"
                    className="text-2xl my-1.5"
                  >
                    <AccordionItemButton className="p-4 rounded-3xl text-left w-full cursor-pointer bg-purple-500">
                      {isSidebarExpanded ? (
                        <div
                          id="expanded-side-bar-heading"
                          className="grid grid-cols-3 gap-2"
                        >
                          <div className="text-white col-start-1 col-end-4">
                            {group.groupName}
                          </div>
                          <div className="col-end-5">
                            <AccordionItemState>
                              {({ expanded }) =>
                                expanded ? (
                                  <ChevronDoubleUpIcon className="h-10 w-10 text-white" />
                                ) : (
                                  <ChevronDoubleDownIcon className="h-10 w-10 text-white" />
                                )
                              }
                            </AccordionItemState>
                          </div>
                        </div>
                      ) : (
                        <AccordionItemState>
                          {({ expanded }) =>
                            expanded ? (
                              <ChevronDoubleUpIcon className="h-10 w-10 text-white" />
                            ) : (
                              <ChevronDoubleDownIcon className="h-10 w-10 text-white" />
                            )
                          }
                        </AccordionItemState>
                      )}
                    </AccordionItemButton>
                  </AccordionItemHeading>
                </div>
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
                  {group.followedChannels.length === 0 && (
                    <div className="text-center">No channels to show</div>
                  )}
                </div>
              </AccordionItemPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>}
    </div>
  );
};

export default AccordianChannels;
