import { useEffect, useState } from "react";
import {
  buildAuthUrl,
  extractTokenFromRedirectUrl,
} from "../../utils/getValidTwitchToken";
import { messageLogger } from "@src/pages/utils/logger";
import { constants, TWITCH_LOGGED_OUT_KEY } from "@src/pages/utils/constants";
import { useTwitchToken } from "../../hooks/userTwitchToken";

const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID;

const Authenticate = ({ isSidebarExpanded }: { isSidebarExpanded: any }) => {
  const [tokenChecked, setTokenChecked] = useState(false);
  const twitchToken = useTwitchToken();

  const logout = () => {
    chrome.storage.local.remove("twitchToken", () => {
      messageLogger(constants.location.POPUP, "User logged out");
    });
  };

  const fetchTwitchUser = async (accessToken: string) => {
    messageLogger(constants.location.POPUP, "Fetching Twitch user data");
    try {
      const res = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": CLIENT_ID,
        },
      });

      if (!res.ok) throw new Error(`API call failed with status ${res.status}`);

      const data = await res.json();
      const userData = data.data?.[0];

      if (userData?.display_name) {
        const user = userData.display_name;
        const userImage = userData.profile_image_url;
        messageLogger(constants.location.POPUP, "Fetched Twitch user", user);
        chrome.storage.local.set({ twitchUserId: userData.id });
        chrome.storage.local.set({ twitchUserImage: userImage });
      }
    } catch (error) {
      messageLogger(
        constants.location.POPUP,
        "Twitch token invalid or expired",
        error
      );
      logout(); // clean up on failure
    }
  };

  useEffect(() => {
    const checkToken = async () => {
      if (twitchToken) {
        fetchTwitchUser(twitchToken);
      }
      setTokenChecked(true);
    };

    if (!chrome.extension.inIncognitoContext) {
      checkToken();
    }
  }, [twitchToken]);

  if (!tokenChecked) {
    return <div>Checking Twitch login...</div>;
  }

  if (!twitchToken) {
    return (
      <div>
        <button
          className="bg-purple-500 text-white font-bold py-2 px-4 mt-2 rounded"
          onClick={() => {
            chrome.identity.launchWebAuthFlow(
              {
                url: buildAuthUrl(),
                interactive: true,
              },
              async (redirectUrl) => {
                if (chrome.runtime.lastError) {
                  console.error("Auth failed", chrome.runtime.lastError);
                  return;
                }

                if (!redirectUrl) {
                  console.error("No redirect URL received");
                  return;
                }

                const accessToken = extractTokenFromRedirectUrl(redirectUrl);

                if (!accessToken) {
                  console.error(
                    "Failed to extract access token from redirect URL"
                  );
                  return;
                }
                await chrome.storage.local.set(
                  { twitchToken: accessToken, tokenIssuedAt: Date.now(), [TWITCH_LOGGED_OUT_KEY]: false },
                  () => {
                    console.log("[AUTH] Twitch token stored");
                  }
                );
                fetchTwitchUser(accessToken);
              }
            );
          }}
        >
          Connect Twitch
        </button>
      </div>
    );
  }
};

export default Authenticate;
