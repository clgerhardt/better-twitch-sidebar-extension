import { MouseEvent, useLayoutEffect, useRef } from "react";
import type { SidebarChannel } from "@src/pages/utils/layoutGroups";
import { buildRow } from "../../rows/buildRow";
import { nativeRowsByLogin } from "../../rows/nativeRows";

// One channel, shown as a row that looks like Twitch's own. The row is plain DOM built from Twitch's
// markup (see rows/buildRow.ts); React only hosts it and handles the click.
const ChannelRow = ({ channel, nativeVersion, collapsed }: { channel: SidebarChannel; nativeVersion: number; collapsed: boolean }) => {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    host.current?.replaceChildren(buildRow(channel, collapsed));
  }, [channel, nativeVersion, collapsed]);

  const open = (event: MouseEvent) => {
    // Let the browser handle "open in a new tab" and friends with the row's real link
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Twitch's own row navigates without reloading the page, so use it when there is one
    const native = nativeRowsByLogin().get(channel.login.toLowerCase());
    if (native) native.click();
    else window.location.href = channel.channelLink;
  };

  return <div ref={host} onClick={open} />;
};

export default ChannelRow;
