import type { SidebarChannel } from "@src/pages/utils/layoutGroups";
import { OFFLINE_AVATAR_CLASS, OFFLINE_LINK_CLASSES, isLiveRow, nativeRowsByLogin, selectors } from "./nativeRows";
import { liveRowTemplate } from "./rowTemplates";
import { count, t } from "@src/pages/shared/i18n/store";

const { TITLE, METADATA, STATUS } = selectors;

const setText = (el: Element | null | undefined, text: string) => {
  if (!el) return;
  el.textContent = text;
  if (el.hasAttribute("title")) el.setAttribute("title", text);
};

// The channel's live details, from our own data so they change with each refresh. A copy of Twitch's own row
// keeps Twitch's game name: Twitch shows it in the user's language, and the API only has the English one.
const syncDetails = (row: HTMLAnchorElement, channel: SidebarChannel, fromTwitchRow = false) => {
  row.removeAttribute("data-a-id");
  row.setAttribute("href", `/${channel.login}`);
  // The game is the paragraph marked dir="auto" (the name block can hold several paragraphs, for
  // example "+1" on a shared stream, so its position is not reliable). Offline rows have it empty.
  const gameLine = row.querySelector(`${METADATA} p[dir=auto]`);
  if (!channel.isLive) {
    setText(gameLine, "");
    return;
  }
  if (!fromTwitchRow) setText(gameLine, channel.streamingContent ?? "");
  const viewers = count(channel.viewers); // "1.1K"
  const status = row.querySelector(STATUS);
  // The count appears twice: an abbreviated span ("1.1K") and, right after it, a paragraph ("1.1K viewers")
  status?.querySelectorAll("span[aria-hidden]").forEach((span) => {
    setText(span, viewers);
    if (span.nextElementSibling?.tagName === "P") setText(span.nextElementSibling, t("row.viewers", { count: channel.viewers, countText: viewers }));
  });
};

// Twitch's offline row, from a live one: dimmed avatar and link, no game, a plain "Offline" label
const makeOffline = (row: HTMLAnchorElement) => {
  row.classList.add(...OFFLINE_LINK_CLASSES);
  row.querySelector(".side-nav-card__avatar")?.classList.add(OFFLINE_AVATAR_CLASS);
  const status = row.querySelector(STATUS);
  if (status) {
    const labelClass = status.querySelector("span")?.className ?? "";
    status.innerHTML = `<span class="${labelClass}"></span>`;
    status.querySelector("span")!.textContent = t("row.offline");
  }
};

// One channel as a row that looks like Twitch's own:
//   - if Twitch rendered a row for this channel (and agrees it is live/offline), a copy of it, so
//     badges such as Watch Streak, Hype Train and shared-stream "+1" come along;
//   - otherwise a plain row built from the template.
export const buildRow = (channel: SidebarChannel, collapsed = false): HTMLAnchorElement => {
  const row = buildFullRow(channel);
  if (collapsed) collapseRow(row, channel);
  return row;
};

// In the collapsed side nav Twitch renders no rows of its own, so ours come from the expanded
// template; keep only the avatar, the way Twitch shows a collapsed row
const collapseRow = (row: HTMLAnchorElement, channel: SidebarChannel) => {
  Array.from(row.children).forEach((child) => {
    if (!child.classList.contains("side-nav-card__avatar")) child.remove();
  });
  // Twitch's collapsed row: the avatar centered in the rail with 4px / 8px around it. Twitch's row also
  // holds an empty tooltip element with a -5px margin, which sits the avatar 3px right of dead center
  row.style.cssText = "display:flex;justify-content:center;align-items:center;padding:4px 8px";
  row.querySelector<HTMLElement>(".side-nav-card__avatar")?.style.setProperty("margin-right", "-5px");
  row.removeAttribute("title");
  row.setAttribute("aria-label", channel.channelName);
};

const buildFullRow = (channel: SidebarChannel): HTMLAnchorElement => {
  const native = nativeRowsByLogin().get(channel.login.toLowerCase());
  if (native && isLiveRow(native) === channel.isLive) {
    const row = native.cloneNode(true) as HTMLAnchorElement;
    syncDetails(row, channel, true);
    return row;
  }

  const row = liveRowTemplate();
  // The row's "Live" label sits right after the live indicator; its text is the language of whichever page the
  // template came from, so it is set here rather than trusted
  const liveLabel = row.querySelector(`${STATUS} .tw-channel-status-indicator + p`);
  if (liveLabel) liveLabel.textContent = t("row.live");
  if (!channel.isLive) makeOffline(row);
  syncDetails(row, channel);
  setText(row.querySelector(TITLE), channel.channelName);
  const avatar = row.querySelector("img");
  if (avatar && channel.channelImage) avatar.setAttribute("src", channel.channelImage);
  return row;
};
