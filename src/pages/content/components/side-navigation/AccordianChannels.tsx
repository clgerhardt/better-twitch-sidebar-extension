import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
  AccordionItemState,
} from "react-accessible-accordion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import useSidebarState from "../../hooks/useSidebarState";
import useGlobalState from "../../hooks/useGlobalState";
import NotConnectedContent from "./NotConnectedContent";
import { messageLogger } from "@src/pages/utils/logger";
import { constants } from "@src/pages/utils/constants";
import { useSidebarGroups } from "../../hooks/useSidebarGroups";
import RefreshProgress from "./RefreshProgress";
import SignedOutContent from "./SignedOutContent";
import { usePageAccount } from "../../hooks/usePageAccount";
import { useNeedsReconnect } from "../../hooks/useNeedsReconnect";
import ExpiredContent from "./ExpiredContent";
import ChannelRow from "./ChannelRow";
import { useNativeRowsVersion } from "../../hooks/useNativeRows";

const AccordianChannels = () => {
  const isSidebarExpanded = useSidebarState();
  const globalState = useGlobalState();
  const pageAccount = usePageAccount();
  const needsReconnect = useNeedsReconnect();
  const { groups, loading, error, fetchedAt } = useSidebarGroups();
  const [visibleGroups, setVisibleGroups] = useState(groups);

  const nativeVersion = useNativeRowsVersion();

  // When the side nav is collapsed a header shows only an initial, so hovering or focusing it says
  // which group it is. The tooltip lives on the page body: the sidebar clips anything sticking out.
  const [tip, setTip] = useState<{ name: string; live?: number; left: number; top: number } | null>(null);
  const showTip = (element: HTMLElement, name: string, live?: number) => {
    const rect = element.getBoundingClientRect();
    setTip({ name, live, left: rect.right + 8, top: rect.top + rect.height / 2 });
  };
  const hideTip = () => setTip(null);

  useEffect(() => {
    messageLogger(constants.location.UI_COMPONENT, "groups", groups);
    setVisibleGroups(groups); // ensure re-render if `groups` is a stable reference
  }, [groups]);

  if (pageAccount?.status === "signed_out") {
    return <SignedOutContent isSidebarExpanded={isSidebarExpanded} />;
  }

  if (!globalState.loggedIn) {
    return <NotConnectedContent isSidebarExpanded={isSidebarExpanded} />;
  }

  if (needsReconnect) {
    return <ExpiredContent isSidebarExpanded={isSidebarExpanded} />;
  }

  if (loading) {
    return <div className="text-center">Loading groups and channels...</div>;
  }

  if (error === "Missing Twitch credentials") {
    return <NotConnectedContent isSidebarExpanded={isSidebarExpanded} />;
  }

  if (error) {
    return <div className="text-center text-red-500">Error loading groups: {error}</div>;
  }

  return (
    <div>
      <RefreshProgress fetchedAt={fetchedAt} />
      <div className="-mx-[0.4rem] overflow-y-auto" style={{ maxHeight: "50vh" }}>
        {/* preExpanded is only read on mount, and groups arrive after loading ends, so remount once they exist */}
        <Accordion key={groups.length > 0 ? "populated" : "empty"} allowZeroExpanded preExpanded={groups.length > 0 ? [groups[0].groupName] : []}>
          {visibleGroups.map((group) => (
          <AccordionItem key={group.groupName} uuid={group.groupName}>
            <AccordionItemHeading id="expanded-side-bar-title" className="my-1">
              <AccordionItemButton
                title={isSidebarExpanded ? `${group.numberOfLiveChannels} live of ${group.numberOfChannels}` : undefined}
                aria-label={isSidebarExpanded ? undefined : group.groupName}
                onMouseEnter={(e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, group.groupName, group.numberOfLiveChannels)}
                onMouseLeave={hideTip}
                onFocus={(e: React.FocusEvent<HTMLElement>) => showTip(e.currentTarget, group.groupName, group.numberOfLiveChannels)}
                onBlur={hideTip}
                className={`flex w-full cursor-pointer items-center gap-3 border-l-[3px] border-solid border-purple-500 bg-[color-mix(in_srgb,var(--color-text-base,#efeff1)_8%,transparent)] py-2 text-left text-[1.4rem] font-medium text-[var(--color-text-base,#efeff1)] ${isSidebarExpanded ? "px-3" : "justify-center gap-1 px-1"}`}
              >
                {!isSidebarExpanded && (
                  <span aria-hidden="true" className="text-[1.4rem] leading-none">
                    {Array.from(group.groupName)[0]?.toUpperCase()}
                  </span>
                )}
                {isSidebarExpanded && (
                  <>
                    <span id="expanded-side-bar-heading" className="min-w-0 truncate">
                      {group.groupName}
                    </span>
                    <span
                      data-testid="group-live-count"
                      className={`rounded-full px-2 text-[1.1rem] leading-[1.7rem] ${
                        group.numberOfLiveChannels > 0 ? "bg-purple-500 text-white" : "bg-[var(--color-border-base,#3a3a3d)] text-[var(--color-text-base,#efeff1)]"
                      }`}
                    >
                      {group.numberOfLiveChannels}
                    </span>
                  </>
                )}
                <AccordionItemState>
                  {({ expanded }) =>
                    expanded ? (
                      <ChevronUpIcon className={`h-6 w-6 text-[var(--color-text-alt-2,#adadb8)] ${isSidebarExpanded ? "ml-auto" : ""}`} />
                    ) : (
                      <ChevronDownIcon className={`h-6 w-6 text-[var(--color-text-alt-2,#adadb8)] ${isSidebarExpanded ? "ml-auto" : ""}`} />
                    )
                  }
                </AccordionItemState>
              </AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel className="px-[0.4rem] pt-1">
              <div data-testid="group-container">
                <ul role="list" className="m-0 list-none p-0">
                  {group.followedChannels.map((channel) => (
                    <li key={channel.login}>
                      <ChannelRow channel={channel} nativeVersion={nativeVersion} />
                    </li>
                  ))}
                </ul>
                {group.followedChannels.length === 0 && (
                  <div
                    className="text-center"
                    onMouseEnter={isSidebarExpanded ? undefined : (e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, "No channels")}
                    onMouseLeave={hideTip}
                  >
                    {isSidebarExpanded ? (
                      "No channels to show"
                    ) : (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">No channels to show</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </AccordionItemPanel>
          </AccordionItem>
          ))}
        </Accordion>
      </div>
      {tip &&
        !isSidebarExpanded &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: tip.left,
              top: tip.top,
              transform: "translateY(-50%)",
              zIndex: 2147483000,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              background: "#0e0e10",
              color: "#efeff1",
              border: "1px solid #3a3a3d",
              borderRadius: 4,
              padding: "0.5rem 1rem",
              fontSize: "1.3rem",
              lineHeight: 1.3,
            }}
          >
            <div style={{ fontWeight: 600 }}>{tip.name}</div>
            {tip.live !== undefined && <div style={{ color: "#adadb8" }}>{tip.live} live</div>}
          </div>,
          document.body
        )}
    </div>
  );
};

export default AccordianChannels;
