import { useEffect, useState } from "react";
import { useTwitchToken } from "../../hooks/userTwitchToken";
import { MESSAGES } from "../../../shared/messages";
import { usePageAccount } from "../../hooks/usePageAccount";
import { connectErrorMessage } from "../../../shared/twitch/connectMessages";

const Authenticate = ({ isSidebarExpanded }: { isSidebarExpanded: any }) => {
  const [tokenChecked, setTokenChecked] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const twitchToken = useTwitchToken();
  const pageAccount = usePageAccount();

  useEffect(() => {
    // The background stores the user and the profile picture when connecting; this only shows the button
    if (!chrome.extension.inIncognitoContext) {
      setTokenChecked(true);
    }
  }, [twitchToken]);

  if (!tokenChecked) {
    return <div>Checking connection...</div>;
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
