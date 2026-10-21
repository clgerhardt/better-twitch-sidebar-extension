// One-shot requests to the background service worker, sent with chrome.runtime.sendMessage
export const MESSAGES = {
  // Popup: run the interactive Twitch login in the background
  CONNECT_TWITCH: "CONNECT_TWITCH",
  // Content script or popup: refresh the stored channel snapshot (force skips the freshness check,
  // follows fetches the follow list now even if the stored one is recent)
  REFRESH_CHANNELS: "REFRESH_CHANNELS",
  // Content script: the user pressed Follow on a channel (login, displayName); replies { found }
  FOLLOW_CLICKED: "FOLLOW_CLICKED",
  // Content script: the user pressed Unfollow on a channel (login, displayName); replies { gone }
  UNFOLLOW_CLICKED: "UNFOLLOW_CLICKED",
} as const;
