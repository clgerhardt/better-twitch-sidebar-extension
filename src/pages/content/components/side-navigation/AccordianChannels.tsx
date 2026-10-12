import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
  AccordionItemState,
} from "react-accessible-accordion";
import { useEffect, useState } from "react";
import {
  ChevronDoubleDownIcon,
  ChevronDoubleUpIcon,
} from "@heroicons/react/24/outline";
import useSidebarState from "../../hooks/useSidebarState";
import useGlobalState from "../../hooks/useGlobalState";
import NotLoggedInContent from "./NotLoggedInContent";
import { messageLogger } from "@src/pages/utils/logger";
import { constants } from "@src/pages/utils/constants";
import { useSidebarGroups } from "../../hooks/useSidebarGroups";
import RefreshProgress from "./RefreshProgress";
import ChannelRow from "./ChannelRow";
import { useNativeRowsVersion } from "../../hooks/useNativeRows";

const AccordianChannels = ({ tabId }: { tabId: string }) => {
  const isSidebarExpanded = useSidebarState(tabId);
  const globalState = useGlobalState();
  const { groups, loading, error, fetchedAt } = useSidebarGroups();
  const [visibleGroups, setVisibleGroups] = useState(groups);

  const nativeVersion = useNativeRowsVersion();

  useEffect(() => {
    messageLogger(constants.location.UI_COMPONENT, "groups", groups);
    setVisibleGroups(groups); // ensure re-render if `groups` is a stable reference
  }, [groups]);

  if (!globalState.loggedIn) {
    return <div><NotLoggedInContent isSidebarExpanded={isSidebarExpanded} /></div>
  }

  if (loading) {
    return <div className="text-center">Loading groups and channels...</div>;
  }

  if (error === "Missing Twitch credentials") {
    return <NotLoggedInContent isSidebarExpanded={isSidebarExpanded} />;
  }

  if (error) {
    return <div className="text-center text-red-500">Error loading groups: {error}</div>;
  }

  return (
    <div>
      <RefreshProgress fetchedAt={fetchedAt} />
      <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
        <Accordion allowZeroExpanded>
          {visibleGroups.map((group) => (
          <AccordionItem key={group.groupName}>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="col-start-1 col-end-4">
                <AccordionItemHeading
                  id="expanded-side-bar-title"
                  className="text-2xl my-1.5"
                >
                  <AccordionItemButton className={isSidebarExpanded ? "p-4 rounded-3xl text-left w-full cursor-pointer bg-purple-500" : "flex justify-center p-4 rounded-3xl text-left w-full cursor-pointer bg-purple-500"}>
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
                <ul role="list" className="m-0 list-none p-0">
                  {group.followedChannels.map((channel) => (
                    <li key={channel.login}>
                      <ChannelRow channel={channel} nativeVersion={nativeVersion} />
                    </li>
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
      </div>
    </div>
  );
};

export default AccordianChannels;
