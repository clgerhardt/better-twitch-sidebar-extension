// One-shot requests to the background service worker, sent with chrome.runtime.sendMessage
export const MESSAGES = {
  // Popup: run the interactive Twitch login in the background
  CONNECT_TWITCH: "CONNECT_TWITCH",
  // Content script or popup: refresh the stored channel snapshot (force skips the freshness check)
  REFRESH_CHANNELS: "REFRESH_CHANNELS",
} as const;
