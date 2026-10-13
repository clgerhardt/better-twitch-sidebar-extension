import { GLOBAL_STATE_KEY, PAGE_ACCOUNT_KEY, TOKEN_EXPIRES_AT_KEY, TWITCH_LOGGED_OUT_KEY } from "../utils/constants";
import { buildAuthUrl, extractTokenFromRedirectUrl, revokeTwitchToken, validateToken } from "../content/utils/getValidTwitchToken";

export type ConnectResult =
  | { ok: true }
  | { ok: false; reason: "not_signed_in" | "cancelled" | "no_token" | "user_lookup_failed" | "wrong_account" };

// The interactive login lives in the service worker: the toolbar popup closes as soon as the Twitch
// window takes focus, which would drop the login result.
//
// The extension only connects the Twitch account that is signed in on twitch.tv. The page tells us
// who that is; the token's owner (from Twitch's validate call) must be the same account.
export const connectTwitch = async (): Promise<ConnectResult> => {
  const pageAccount = (await chrome.storage.local.get(PAGE_ACCOUNT_KEY))[PAGE_ACCOUNT_KEY];
  if (pageAccount?.status !== "signed_in") return { ok: false, reason: "not_signed_in" };

  const redirectUrl = await new Promise<string | undefined>((resolve) => {
    chrome.identity.launchWebAuthFlow({ url: buildAuthUrl(), interactive: true }, (result) => {
      resolve(chrome.runtime.lastError ? undefined : result);
    });
  });
  if (!redirectUrl) return { ok: false, reason: "cancelled" };

  const token = extractTokenFromRedirectUrl(redirectUrl);
  if (!token) return { ok: false, reason: "no_token" };

  const validated = await validateToken(token);
  if (!validated?.userId) return { ok: false, reason: "user_lookup_failed" };
  if (validated.userId !== pageAccount.id) {
    await revokeTwitchToken(token);
    return { ok: false, reason: "wrong_account" };
  }

  const user = await fetchTwitchUser(token);
  if (!user) return { ok: false, reason: "user_lookup_failed" };

  const current = await chrome.storage.local.get(GLOBAL_STATE_KEY);
  await chrome.storage.local.set({
    twitchToken: token,
    ...(validated.expiresAt ? { [TOKEN_EXPIRES_AT_KEY]: validated.expiresAt } : {}),
    twitchUserId: user.id,
    twitchUserImage: user.profile_image_url,
    [TWITCH_LOGGED_OUT_KEY]: false,
    [GLOBAL_STATE_KEY]: { ...(current[GLOBAL_STATE_KEY] || {}), loggedIn: true, lastUpdated: new Date().toISOString() },
  });
  if (!validated.expiresAt) await chrome.storage.local.remove(TOKEN_EXPIRES_AT_KEY);
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
