const TWITCH_AUTH_BASE = "https://id.twitch.tv/oauth2/authorize";
const EXPIRES_IN_MS = 4 * 60 * 60 * 1000; // 4 hours
const SCOPES = ["user:read:follows"];
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

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

export const getValidTwitchToken = async (): Promise<string | null> => {
  const { twitchToken, tokenIssuedAt } = await chrome.storage.local.get([
    "twitchToken",
    "tokenIssuedAt",
  ]);

  if (!twitchToken || isTokenExpired(tokenIssuedAt)) {
    return await trySilentReauth();
  }

  return twitchToken;
};
