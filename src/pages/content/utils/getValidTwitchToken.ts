import {
  CHANNEL_GROUPS_KEY,
  CHANNEL_SNAPSHOT_KEY,
  FOLLOWED_CHANNELS_KEY,
  GLOBAL_STATE_KEY,
  GROUP_NAMES_KEY,
  DEFAULT_GROUP_KEY,
  GROUP_COLORS_KEY,
  PENDING_FOLLOWS_KEY,
  GROUPS_SYNC_STATE_KEY,
  GROUPS_SYNC_READY_KEY,
  SNAPSHOT_ERROR_KEY,
  TOKEN_EXPIRES_AT_KEY,
  TWITCH_LOGGED_OUT_KEY,
} from "../../utils/constants";

const TWITCH_AUTH_BASE = "https://id.twitch.tv/oauth2/authorize";
// Renew a little before the real expiry so a request never goes out with a token about to die
const EXPIRY_MARGIN_MS = 60_000;
const SCOPES = ["user:read:follows"];
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

// A plain authorize request: Twitch approves it silently for the account the browser is signed in
// to, which is the only account the extension connects (the caller checks the token's owner).
export const buildAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_TWITCH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: SCOPES.join(" "),
  });
  return `${TWITCH_AUTH_BASE}?${params.toString()}`;
};

export const extractTokenFromRedirectUrl = (redirectUrl: string): string | null => {
  const match = redirectUrl.match(/access_token=([^&]*)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

// The redirect says neither how long the token lasts nor whose it is, so ask Twitch. Returns null
// when that cannot be determined (offline).
export const validateToken = async (token: string): Promise<{ userId: string | null; expiresAt: number | null } | null> => {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
    if (!res.ok) return null;
    const { user_id, expires_in } = await res.json();
    return {
      userId: typeof user_id === "string" ? user_id : null,
      expiresAt: typeof expires_in === "number" ? Date.now() + expires_in * 1000 : null,
    };
  } catch {
    return null;
  }
};

// When the expiry is unknown the token is used until Twitch rejects it
export const fetchTokenExpiry = async (token: string): Promise<number | null> => (await validateToken(token))?.expiresAt ?? null;

const isTokenExpired = (expiresAt: number | undefined): boolean => {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - EXPIRY_MARGIN_MS;
};

// Concurrent callers (several hooks, strict-mode remounts) share one login attempt
let silentReauth: Promise<string | null> | null = null;
export const trySilentReauth = (): Promise<string | null> => {
  silentReauth ??= runSilentReauth().finally(() => {
    silentReauth = null;
  });
  return silentReauth;
};

const runSilentReauth = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: buildAuthUrl(),
        interactive: false,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          resolve(null);
          return;
        }

        const match = extractTokenFromRedirectUrl(redirectUrl);
        if (match) {
          const token = match;
          const validated = await validateToken(token);
          // The browser's Twitch session may belong to someone else by now: never swap in another
          // account's token under this account's groups
          const { twitchUserId } = await chrome.storage.local.get("twitchUserId");
          if (twitchUserId && validated?.userId !== twitchUserId) {
            resolve(null);
            return;
          }
          const expiresAt = validated?.expiresAt ?? null;

          // One write: a listener reacting to the new token must already see its expiry
          if (!expiresAt) await chrome.storage.local.remove(TOKEN_EXPIRES_AT_KEY);
          await chrome.storage.local.set({ twitchToken: token, ...(expiresAt ? { [TOKEN_EXPIRES_AT_KEY]: expiresAt } : {}) });
          resolve(token);
        } else {
          resolve(null);
        }
      }
    );
  });
};

// Ends the session and keeps it ended: without the logged-out flag the next token check would
// silently log back in, since the browser usually still has a Twitch session.
export const revokeTwitchToken = async (token: string) => {
  try {
    await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: import.meta.env.VITE_TWITCH_CLIENT_ID, token }).toString(),
    });
  } catch {
    // Logging out must not depend on the network; the token also expires on its own
  }
};

export const logoutTwitch = async () => {
  const stored = await chrome.storage.local.get([GLOBAL_STATE_KEY, "twitchToken"]);
  await chrome.storage.local.set({
    [TWITCH_LOGGED_OUT_KEY]: true,
    [GLOBAL_STATE_KEY]: { ...(stored[GLOBAL_STATE_KEY] || {}), loggedIn: false },
  });
  // Everything the account created goes too (its groups, which channels it grouped, and its cached
  // follow list), so on a shared machine the next account never sees it
  await chrome.storage.local.remove([
    "twitchToken",
    TOKEN_EXPIRES_AT_KEY,
    "tokenIssuedAt",
    "twitchUserId",
    "twitchUserImage",
    GROUP_NAMES_KEY,
    DEFAULT_GROUP_KEY,
    GROUP_COLORS_KEY,
    CHANNEL_GROUPS_KEY,
    FOLLOWED_CHANNELS_KEY,
    CHANNEL_SNAPSHOT_KEY,
    PENDING_FOLLOWS_KEY,
    GROUPS_SYNC_STATE_KEY,
    GROUPS_SYNC_READY_KEY,
    SNAPSHOT_ERROR_KEY,
  ]);
  if (stored.twitchToken) await revokeTwitchToken(stored.twitchToken);
};

export const getValidTwitchToken = async (): Promise<string | null> => {
  const { twitchToken, [TOKEN_EXPIRES_AT_KEY]: expiresAt, [TWITCH_LOGGED_OUT_KEY]: loggedOut } = await chrome.storage.local.get([
    "twitchToken",
    TOKEN_EXPIRES_AT_KEY,
    TWITCH_LOGGED_OUT_KEY,
  ]);

  if (loggedOut) return null;

  // Only the Connect button creates a connection. A silent sign-in here would connect any browser
  // that is signed in to Twitch the moment a popup opens, without its account being recorded.
  if (!twitchToken) return null;

  if (isTokenExpired(expiresAt)) {
    return await trySilentReauth();
  }

  return twitchToken;
};
