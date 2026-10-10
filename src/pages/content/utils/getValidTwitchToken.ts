import { GLOBAL_STATE_KEY, TWITCH_LOGGED_OUT_KEY } from "../../utils/constants";

const TWITCH_AUTH_BASE = "https://id.twitch.tv/oauth2/authorize";
const EXPIRES_IN_MS = 4 * 60 * 60 * 1000; // 4 hours
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

const isTokenExpired = (issuedAt: number | undefined): boolean => {
  if (!issuedAt) return true;
  return Date.now() > issuedAt + EXPIRES_IN_MS;
};

const trySilentReauth = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: buildAuthUrl(),
        interactive: false,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          resolve(null);
          return;
        }

        const match = extractTokenFromRedirectUrl(redirectUrl);
        if (match) {
          const token = match;
          const tokenIssuedAt = Date.now();

          chrome.storage.local.set({ twitchToken: token, tokenIssuedAt });
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
  await chrome.storage.local.remove(["twitchToken", "tokenIssuedAt", "twitchUserId", "twitchUserImage"]);
  if (stored.twitchToken) await revokeTwitchToken(stored.twitchToken);
};

export const getValidTwitchToken = async (): Promise<string | null> => {
  const { twitchToken, tokenIssuedAt, [TWITCH_LOGGED_OUT_KEY]: loggedOut } = await chrome.storage.local.get([
    "twitchToken",
    "tokenIssuedAt",
    TWITCH_LOGGED_OUT_KEY,
  ]);

  if (loggedOut) return null;

  if (!twitchToken || isTokenExpired(tokenIssuedAt)) {
    return await trySilentReauth();
  }

  return twitchToken;
};
