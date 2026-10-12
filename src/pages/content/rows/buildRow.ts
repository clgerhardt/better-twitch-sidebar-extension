import type { SidebarChannel } from "@src/pages/utils/layoutGroups";
import { OFFLINE_AVATAR_CLASS, OFFLINE_LINK_CLASSES, isLiveRow, nativeRowsByLogin, selectors } from "./nativeRows";
import { liveRowTemplate } from "./rowTemplates";

const { TITLE, METADATA, STATUS } = selectors;

const setText = (el: Element | null | undefined, text: string) => {
  if (!el) return;
  el.textContent = text;
  if (el.hasAttribute("title")) el.setAttribute("title", text);
};

// The channel's live details, from our own data so they change with each refresh
const syncDetails = (row: HTMLAnchorElement, channel: SidebarChannel) => {
  row.removeAttribute("data-a-id");
  row.setAttribute("href", `/${channel.login}`);
  // The game is the paragraph marked dir="auto" (the name block can hold several paragraphs, for
  // example "+1" on a shared stream, so its position is not reliable). Offline rows have it empty.
  const gameLine = row.querySelector(`${METADATA} p[dir=auto]`);
  if (!channel.isLive) {
    setText(gameLine, "");
    return;
  }
  setText(gameLine, channel.streamingContent ?? "");
  const viewers = (channel.viewerCount ?? "").replace(/\s*viewers$/, ""); // "1.1K"
  const status = row.querySelector(STATUS);
  // The count appears twice: an abbreviated span ("1.1K") and, right after it, a paragraph ("1.1K viewers")
  status?.querySelectorAll("span[aria-hidden]").forEach((span) => {
    setText(span, viewers);
    if (span.nextElementSibling?.tagName === "P") setText(span.nextElementSibling, channel.viewerCount ?? "");
  });
};

// Twitch's offline row, from a live one: dimmed avatar and link, no game, a plain "Offline" label
const makeOffline = (row: HTMLAnchorElement) => {
  row.classList.add(...OFFLINE_LINK_CLASSES);
  row.querySelector(".side-nav-card__avatar")?.classList.add(OFFLINE_AVATAR_CLASS);
  const status = row.querySelector(STATUS);
  if (status) {
    const labelClass = status.querySelector("span")?.className ?? "";
    status.innerHTML = `<span class="${labelClass}">Offline</span>`;
  }
};

// One channel as a row that looks like Twitch's own:
//   - if Twitch rendered a row for this channel (and agrees it is live/offline), a copy of it, so
//     badges such as Watch Streak, Hype Train and shared-stream "+1" come along;
//   - otherwise a plain row built from the template.
export const buildRow = (channel: SidebarChannel): HTMLAnchorElement => {
  const native = nativeRowsByLogin().get(channel.login.toLowerCase());
  if (native && isLiveRow(native) === channel.isLive) {
    const row = native.cloneNode(true) as HTMLAnchorElement;
    syncDetails(row, channel);
    return row;
  }

  const row = liveRowTemplate();
  if (!channel.isLive) makeOffline(row);
  syncDetails(row, channel);
  setText(row.querySelector(TITLE), channel.channelName);
  const avatar = row.querySelector("img");
  if (avatar && channel.channelImage) avatar.setAttribute("src", channel.channelImage);
  return row;
};
