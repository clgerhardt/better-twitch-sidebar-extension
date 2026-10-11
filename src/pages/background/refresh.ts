import { createHelixClient } from "../shared/twitch/helix";
import { createRefresher, type RefreshStorage } from "../shared/twitch/refresh";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";

// The only place that talks to the Twitch API. Everything else reads the stored snapshot.
const storage: RefreshStorage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};

const client = createHelixClient({
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  clientId: import.meta.env.VITE_TWITCH_CLIENT_ID,
  // Rate-limit responses are rare and worth keeping an eye on, so always log them
  log: (message, detail) => console.warn(`[helix] ${message}`, detail ?? ""),
});

const refresher = createRefresher({
  client,
  storage,
  now: () => Date.now(),
  log: (message, detail) => messageLogger(constants.location.BACKGROUND, message, detail),
});

export const refreshChannels = refresher.refresh;
