import { GLOBAL_STATE_KEY, TWITCH_LOGGED_OUT_KEY } from "../utils/constants";
import {
  buildAuthUrl,
  buildSwitchAccountUrl,
  extractTokenFromRedirectUrl,
} from "../content/utils/getValidTwitchToken";

export type ConnectResult = { ok: true } | { ok: false; reason: "cancelled" | "no_token" | "user_lookup_failed" };

// The interactive login lives in the service worker: the toolbar popup closes as soon as the Twitch
// window takes focus, which would drop the login result.
export const connectTwitch = async (): Promise<ConnectResult> => {
  const stored = await chrome.storage.local.get(TWITCH_LOGGED_OUT_KEY);
  // After a logout the browser still holds the previous Twitch session, so sign it out first
  const url = stored[TWITCH_LOGGED_OUT_KEY] ? buildSwitchAccountUrl() : buildAuthUrl(true);

  const redirectUrl = await new Promise<string | undefined>((resolve) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (result) => {
      resolve(chrome.runtime.lastError ? undefined : result);
    });
  });
  if (!redirectUrl) return { ok: false, reason: "cancelled" };

  const token = extractTokenFromRedirectUrl(redirectUrl);
  if (!token) return { ok: false, reason: "no_token" };

  const user = await fetchTwitchUser(token);
  if (!user) return { ok: false, reason: "user_lookup_failed" };

  const current = await chrome.storage.local.get(GLOBAL_STATE_KEY);
  await chrome.storage.local.set({
    twitchToken: token,
    tokenIssuedAt: Date.now(),
    twitchUserId: user.id,
    twitchUserImage: user.profile_image_url,
    [TWITCH_LOGGED_OUT_KEY]: false,
    [GLOBAL_STATE_KEY]: { ...(current[GLOBAL_STATE_KEY] || {}), loggedIn: true, lastUpdated: new Date().toISOString() },
  });
  return { ok: true };
};

const fetchTwitchUser = async (token: string) => {
  try {
    const res = await fetch("https://api.twitch.tv/helix/users", {
      headers: { Authorization: `Bearer ${token}`, "Client-Id": import.meta.env.VITE_TWITCH_CLIENT_ID },
    });
    if (!res.ok) return null;
    return (await res.json()).data?.[0] ?? null;
  } catch {
    return null;
  }
};
