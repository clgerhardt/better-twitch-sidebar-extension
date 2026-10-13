import { useEffect, useState } from "react";
import { messageLogger } from "@src/pages/utils/logger";
import { constants } from "@src/pages/utils/constants";
import { useTwitchToken } from "../../hooks/userTwitchToken";
import { MESSAGES } from "../../../shared/messages";
import { usePageAccount } from "../../hooks/usePageAccount";
import { connectErrorMessage } from "../../../shared/twitch/connectMessages";

const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID;

const Authenticate = ({ isSidebarExpanded }: { isSidebarExpanded: any }) => {
  const [tokenChecked, setTokenChecked] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const twitchToken = useTwitchToken();
  const pageAccount = usePageAccount();

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
    // Only the account signed in to Twitch can be connected, so there is nothing to offer otherwise
    if (pageAccount?.status !== "signed_in") return null;
    return (
      <div>
        <button
          disabled={connecting}
          className="bg-purple-500 text-white font-bold py-2 px-4 mt-2 rounded disabled:opacity-60"
          onClick={async () => {
            setConnecting(true);
            setConnectError(null);
            // The login runs in the background so it survives this popup closing
            const result = await chrome.runtime.sendMessage({ type: MESSAGES.CONNECT_TWITCH }).catch(() => undefined);
            setConnecting(false);
            if (!result?.ok) setConnectError(connectErrorMessage(result?.reason));
          }}
        >
          {connecting ? "Waiting for Twitch..." : `Connect for ${pageAccount.login}`}
        </button>
        {connectError && <p className="text-red-500 text-sm mt-2">{connectError}</p>}
      </div>
    );
  }
};

export default Authenticate;
