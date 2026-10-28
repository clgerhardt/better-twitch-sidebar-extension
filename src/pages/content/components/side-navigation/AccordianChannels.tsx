import {
  Accordion,
  AccordionItem,
  AccordionItemButton,
  AccordionItemHeading,
  AccordionItemPanel,
  AccordionItemState,
} from "react-accessible-accordion";
import { useEffect, useRef, useState } from "react";
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
import useGroupsSyncWait from "../../hooks/useGroupsSyncWait";
import { useDirection, useT } from "@src/pages/shared/i18n/store";
import type { MessageKey } from "@src/pages/shared/i18n/i18n";
import { groupLabel } from "../../utils/groupLabel";
import type { SidebarChannel } from "@src/pages/utils/layoutGroups";
import { DEFAULT_GROUP_COLOR, readableTextColor } from "@src/pages/utils/groupColor";
import { isSharedRow, nativeRowsByLogin } from "../../rows/nativeRows";
import { readNativeTooltip } from "../../rows/nativeTooltip";

// Where a tooltip goes beside an element: on the side of it with room. Twitch's sidebar is at the left edge
// of the page, or at the right edge when Twitch is shown right to left.
const placeBeside = (rect: DOMRect): { left?: number; right?: number } =>
  rect.left + rect.width / 2 > window.innerWidth / 2 ? { right: window.innerWidth - rect.left + 8 } : { left: rect.right + 8 };

const AccordianChannels = () => {
  const isSidebarExpanded = useSidebarState();
  const globalState = useGlobalState();
  const pageAccount = usePageAccount();
  const needsReconnect = useNeedsReconnect();
  const { groups, loading, error, fetchedAt } = useSidebarGroups();
  const [visibleGroups, setVisibleGroups] = useState(groups);

  const nativeVersion = useNativeRowsVersion();
  const waitingForSync = useGroupsSyncWait();
  const t = useT();
  const dir = useDirection();

  // When the side nav is collapsed a header shows only an initial, so hovering or focusing it says
  // which group it is. The tooltip lives on the page body: the sidebar clips anything sticking out.
  const [tip, setTip] = useState<{ name: string; live?: number; detail?: string; content?: HTMLElement; kind: "group" | "channel"; place: { left?: number; right?: number }; top: number } | null>(null);
  const showTip = (element: HTMLElement, name: string, live?: number) => {
    const rect = element.getBoundingClientRect();
    setTip({ name, live, kind: "group", place: placeBeside(rect), top: rect.top + rect.height / 2 });
  };
  const hoveredLogin = useRef<string | null>(null);
  const hideTip = () => {
    hoveredLogin.current = null;
    setTip(null);
  };

  // Twitch shows a live channel's stream title beside its row. Our rows are copies without Twitch's
  // handlers, so show it ourselves. In the collapsed rail a row is only an avatar, so the name goes with it.
  const showChannelTip = (element: HTMLElement | null, channel: SidebarChannel) => {
    const title = channel.isLive ? channel.streamTitle : undefined;
    if (!element || (isSidebarExpanded && !title)) return hideTip();
    hoveredLogin.current = channel.login;
    const rect = element.getBoundingClientRect();
    setTip({ name: isSidebarExpanded ? "" : channel.channelName, detail: title, kind: "channel", place: placeBeside(rect), top: rect.top });

    // A shared stream has more to show than its title: take Twitch's own tooltip for it
    const native = channel.isLive ? nativeRowsByLogin().get(channel.login.toLowerCase()) : undefined;
    if (native && isSharedRow(native)) {
      readNativeTooltip(native).then((content) => {
        if (content && hoveredLogin.current === channel.login) setTip((current) => current && { ...current, name: "", detail: undefined, content });
      });
    }
  };

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

  if (loading || waitingForSync === null) {
    return <div className="text-center">{t("sidebar.loading")}</div>;
  }

  if (error === "Missing Twitch credentials") {
    return <NotConnectedContent isSidebarExpanded={isSidebarExpanded} />;
  }

  if (error) {
    return <div className="text-center text-red-500">{t("sidebar.error", { error: t(error as MessageKey) })}</div>;
  }

  // The first time after a login the groups come from sync: showing this device's empty ones first would look like a reset
  if (waitingForSync) {
    return <div className="text-center">{t("sidebar.syncing")}</div>;
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
                style={group.color ? { borderInlineStartColor: group.color } : undefined}
                title={isSidebarExpanded ? t("sidebar.liveOf", { live: group.numberOfLiveChannels, total: group.numberOfChannels }) : undefined}
                aria-label={isSidebarExpanded ? undefined : groupLabel(group, t)}
                onMouseEnter={(e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, groupLabel(group, t), group.numberOfLiveChannels)}
                onMouseLeave={hideTip}
                onFocus={(e: React.FocusEvent<HTMLElement>) => showTip(e.currentTarget, groupLabel(group, t), group.numberOfLiveChannels)}
                onBlur={hideTip}
                className={`flex w-full cursor-pointer items-center gap-3 border-s-[3px] border-solid border-purple-500 bg-[color-mix(in_srgb,var(--color-text-base,#efeff1)_8%,transparent)] py-2 text-left text-[1.4rem] font-medium text-[var(--color-text-base,#efeff1)] ${isSidebarExpanded ? "px-3" : "justify-center gap-1 px-1"}`}
              >
                {!isSidebarExpanded && (
                  <span aria-hidden="true" className="text-[1.4rem] leading-none">
                    {Array.from(groupLabel(group, t))[0]?.toUpperCase()}
                  </span>
                )}
                {isSidebarExpanded && (
                  <>
                    <span id="expanded-side-bar-heading" className="min-w-0 truncate">
                      {groupLabel(group, t)}
                    </span>
                    <span
                      data-testid="group-live-count"
                      // With live channels the count wears the group's color (purple until another is picked)
                      style={group.numberOfLiveChannels > 0 ? { background: group.color ?? DEFAULT_GROUP_COLOR, color: readableTextColor(group.color ?? DEFAULT_GROUP_COLOR) } : undefined}
                      className={`rounded-full px-2 text-[1.1rem] leading-[1.7rem] ${
                        group.numberOfLiveChannels > 0 ? "" : "bg-[var(--color-border-base,#3a3a3d)] text-[var(--color-text-base,#efeff1)]"
                      }`}
                    >
                      {group.numberOfLiveChannels}
                    </span>
                  </>
                )}
                <AccordionItemState>
                  {({ expanded }) =>
                    expanded ? (
                      <ChevronUpIcon className={`h-6 w-6 text-[var(--color-text-alt-2,#adadb8)] ${isSidebarExpanded ? "ms-auto" : ""}`} />
                    ) : (
                      <ChevronDownIcon className={`h-6 w-6 text-[var(--color-text-alt-2,#adadb8)] ${isSidebarExpanded ? "ms-auto" : ""}`} />
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
                      <ChannelRow channel={channel} nativeVersion={nativeVersion} collapsed={!isSidebarExpanded} onHover={showChannelTip} />
                    </li>
                  ))}
                </ul>
                {group.followedChannels.length === 0 && (
                  <div
                    className="text-center"
                    onMouseEnter={isSidebarExpanded ? undefined : (e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, t("sidebar.noChannels"))}
                    onMouseLeave={hideTip}
                  >
                    {isSidebarExpanded ? (
                      t("sidebar.noChannelsToShow")
                    ) : (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{t("sidebar.noChannelsToShow")}</span>
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
        (tip.kind === "channel" || !isSidebarExpanded) &&
        createPortal(
          <div
            role="tooltip"
            dir={dir}
            style={{
              position: "fixed",
              ...tip.place,
              top: tip.top,
              transform: tip.kind === "group" ? "translateY(-50%)" : undefined,
              zIndex: 2147483000,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              ...(tip.kind === "channel"
                ? { width: "20.8rem", boxSizing: "border-box", background: "#323239", borderRadius: 6, boxShadow: "0 4px 8px rgba(0,0,0,0.6), 0 0 4px rgba(0,0,0,0.4)", padding: tip.content ? 0 : "0.6rem 0.8rem", fontSize: "1.4rem", lineHeight: 1.4 }
                : { background: "#0e0e10", border: "1px solid #3a3a3d", borderRadius: 4, padding: "0.5rem 1rem", fontSize: "1.3rem", lineHeight: 1.3 }),
              color: "#efeff1",
            }}
          >
            {tip.content && <div ref={(el) => el?.replaceChildren(tip.content!)} />}
            {tip.name && <div style={{ fontWeight: 600 }}>{tip.name}</div>}
            {tip.detail && (
              <div style={{ color: tip.name ? "#adadb8" : undefined, whiteSpace: "normal", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {tip.detail}
              </div>
            )}
            {tip.live !== undefined && <div style={{ color: "#adadb8" }}>{t("sidebar.liveCount", { count: tip.live })}</div>}
          </div>,
          document.body
        )}
    </div>
  );
};

export default AccordianChannels;
