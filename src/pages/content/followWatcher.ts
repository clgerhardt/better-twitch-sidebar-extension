import { MESSAGES } from "../shared/messages";
import { CHANNEL_SNAPSHOT_KEY } from "../utils/constants";
import { isSnapshotFor } from "../shared/twitch/snapshot";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";

// Twitch's Follow button, and the "Yes, unfollow" button of its confirmation. The page's own Unfollow
// button only opens that confirmation, so an unfollow has happened only once the user confirms it.
const FOLLOW_BUTTON = '[data-a-target="follow-button"]';
const UNFOLLOW_CONFIRM_BUTTON = '[data-a-target="modal-unfollow-button"]';
// How long to wait before asking for the follow list again, while Twitch's list has not caught up
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000];

// The channel the page is about: the first part of the address ("/somechannel", "/somechannel/videos")
const loginFromPath = (path: string): string | null => {
  const first = path.split("/")[1]?.toLowerCase() ?? "";
  return /^[a-z0-9_]{1,25}$/.test(first) && !NOT_A_CHANNEL.has(first) ? first : null;
};

// Pages of Twitch that are not a channel's own, though they may have a Follow button
const NOT_A_CHANNEL = new Set(["videos", "directory", "settings", "subscriptions", "friends", "wallet", "drops", "inventory", "turbo", "prime", "search", "downloads", "p", "u", "popout", "embed", "dashboard", "moderator"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isFollowed = async (login: string): Promise<boolean> => {
  const stored = await chrome.storage.local.get(["twitchUserId", CHANNEL_SNAPSHOT_KEY]);
  const snapshot = stored[CHANNEL_SNAPSHOT_KEY];
  return isSnapshotFor(snapshot, stored.twitchUserId) && snapshot.channels.some((c) => c.login.toLowerCase() === login);
};

const trackFollow = async (login: string) => {
  try {
    const outcome = await chrome.runtime.sendMessage({ type: MESSAGES.FOLLOW_CLICKED, login });
    if (outcome?.found) return;
    // Twitch's list has not caught up: the background shows the channel meanwhile; keep asking
    for (const delay of RETRY_DELAYS_MS) {
      await sleep(delay);
      if (!chrome.runtime?.id) return; // the extension was reloaded: this script is orphaned
      await chrome.runtime.sendMessage({ type: MESSAGES.REFRESH_CHANNELS, force: true, follows: true });
      if (await isFollowed(login)) return;
    }
  } catch (error) {
    messageLogger(constants.location.CONTENT_SCRIPT, "could not track the new follow", error);
  }
};

const trackUnfollow = async (login: string) => {
  try {
    const outcome = await chrome.runtime.sendMessage({ type: MESSAGES.UNFOLLOW_CLICKED, login });
    if (outcome?.gone) return;
    // Twitch's list still has the channel (the background keeps it hidden meanwhile); keep asking
    for (const delay of RETRY_DELAYS_MS) {
      await sleep(delay);
      if (!chrome.runtime?.id) return;
      await chrome.runtime.sendMessage({ type: MESSAGES.REFRESH_CHANNELS, force: true, follows: true });
      if (!(await isFollowed(login))) return;
    }
  } catch (error) {
    messageLogger(constants.location.CONTENT_SCRIPT, "could not track the unfollow", error);
  }
};

// When the user presses Follow or Unfollow, make sure the sidebar follows suit without waiting for the
// next scheduled refresh of the follow list
export const watchFollowClicks = () => {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      if (!chrome.runtime?.id) return;
      const follow = target?.closest?.(FOLLOW_BUTTON);
      const confirmed = follow ? null : target?.closest?.(UNFOLLOW_CONFIRM_BUTTON);
      const login = follow || confirmed ? loginFromPath(window.location.pathname) : null;
      if (!login) return;
      if (follow) void trackFollow(login);
      else void trackUnfollow(login);
    },
    true
  );
};
