import { createHelixClient } from "../shared/twitch/helix";
import { createRefresher, type RefreshStorage } from "../shared/twitch/refresh";
import { trySilentReauth } from "../content/utils/getValidTwitchToken";
import { messageLogger } from "../utils/logger";
import { constants, TWITCH_LOGGED_OUT_KEY } from "../utils/constants";

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
  // A quiet login (no window) works while the browser still has a Twitch session for this account
  renewToken: async () => {
    if ((await chrome.storage.local.get(TWITCH_LOGGED_OUT_KEY))[TWITCH_LOGGED_OUT_KEY]) return null;
    return trySilentReauth();
  },
  log: (message, detail) => messageLogger(constants.location.BACKGROUND, message, detail),
});

export const refreshChannels = refresher.refresh;
