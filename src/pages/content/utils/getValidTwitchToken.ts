import {
  CHANNEL_GROUPS_KEY,
  CHANNEL_SNAPSHOT_KEY,
  FOLLOWED_CHANNELS_KEY,
  GLOBAL_STATE_KEY,
  GROUP_NAMES_KEY,
  SNAPSHOT_ERROR_KEY,
  TOKEN_EXPIRES_AT_KEY,
  TWITCH_LOGGED_OUT_KEY,
} from "../../utils/constants";

const TWITCH_AUTH_BASE = "https://id.twitch.tv/oauth2/authorize";
// Renew a little before the real expiry so a request never goes out with a token about to die
const EXPIRY_MARGIN_MS = 60_000;
const SCOPES = ["user:read:follows"];
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

// forceVerify makes Twitch ask the user to authorize the app again instead of approving silently
// because the browser still has a Twitch session. Use it for the interactive login only.
export const buildAuthUrl = (forceVerify = false) => {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_TWITCH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: SCOPES.join(" "),
  });
  if (forceVerify) params.set("force_verify", "true");
  return `${TWITCH_AUTH_BASE}?${params.toString()}`;
};

// Signs the browser out of Twitch, then continues to the authorize screen, so the next person has to
// log in with their own credentials instead of reusing the previous Twitch session. This is the
// same URL Twitch's own "not you? log out" link uses (an undocumented endpoint, so it may change).
export const buildSwitchAccountUrl = () => {
  const authorizeParams = new URLSearchParams({
    client_id: import.meta.env.VITE_TWITCH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: SCOPES.join(" "),
    force_verify: "true",
  });
  const url = new URL("https://id.twitch.tv/logout/redirect");
  url.searchParams.set("login_type", "");
  url.searchParams.set("redirect_params", authorizeParams.toString());
  url.searchParams.set("redirect_path", "https://id.twitch.tv/oauth2/authorize/data");
  return url.toString();
};

export const extractTokenFromRedirectUrl = (redirectUrl: string): string | null => {
  const match = redirectUrl.match(/access_token=([^&]*)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

// The redirect does not say how long the token lasts, so ask Twitch. Returns null when it cannot
// be determined (offline); the token is then used until Twitch rejects it.
export const fetchTokenExpiry = async (token: string): Promise<number | null> => {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
    if (!res.ok) return null;
    const { expires_in } = await res.json();
    return typeof expires_in === "number" ? Date.now() + expires_in * 1000 : null;
  } catch {
    return null;
  }
};

const isTokenExpired = (expiresAt: number | undefined): boolean => {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - EXPIRY_MARGIN_MS;
};

// Concurrent callers (several hooks, strict-mode remounts) share one login attempt
let silentReauth: Promise<string | null> | null = null;
const trySilentReauth = (): Promise<string | null> => {
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
          const expiresAt = await fetchTokenExpiry(token);

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
const revokeTwitchToken = async (token: string) => {
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
    CHANNEL_GROUPS_KEY,
    FOLLOWED_CHANNELS_KEY,
    CHANNEL_SNAPSHOT_KEY,
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

  if (!twitchToken || isTokenExpired(expiresAt)) {
    return await trySilentReauth();
  }

  return twitchToken;
};
