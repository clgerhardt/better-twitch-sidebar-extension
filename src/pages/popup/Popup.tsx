import React, { useEffect, useState } from "react";
import UserGreeting from "./UserGreeting/UserGreeting";
import Banner from "./Banner/Banner";
import GuestGreeting from "./GuestGreeting/GuestGreeting";
import SignedOutGreeting from "./SignedOutGreeting/SignedOutGreeting";
import ExpiredGreeting from "./ExpiredGreeting/ExpiredGreeting";
import { useNeedsReconnect } from "../content/hooks/useNeedsReconnect";
import { usePageAccount } from "../content/hooks/usePageAccount";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";
import { useTwitchToken } from "../content/hooks/userTwitchToken";
import { useStoredUserImage } from "../content/hooks/useStoredUserImage";
import { logoutTwitch } from "../content/utils/getValidTwitchToken";

const Popup = () => {
  const [isIncognito, setIsIncognito] = useState<boolean | null>(
    chrome.extension.inIncognitoContext
  );

  const twitchToken = useTwitchToken();
  const pageAccount = usePageAccount();
  const needsReconnect = useNeedsReconnect();
  const userImage = useStoredUserImage();

  const logout = async () => {
    await logoutTwitch();
    messageLogger(constants.location.POPUP, "User logged out");
  };

  useEffect(() => {
    messageLogger(constants.location.POPUP, "Popup loaded");
    messageLogger(constants.location.POPUP, "Checking if in incognito mode", isIncognito);
  }, []);

  if (isIncognito) {
    return (
      <div id="main-container" className="p-3 text-sm text-[#efeff1]">
        <Banner />
        <p className="mb-0 mt-3">
          This extension does not work in Incognito Mode. Please disable it in your browser settings or use a normal window.
        </p>
      </div>
    );
  }

  return (
    <div id="main-container" className="p-3 text-sm text-[#efeff1]">
      <Banner />
      {twitchToken ? (
        <>
          {pageAccount?.status === "signed_out" ? (
            <SignedOutGreeting />
          ) : needsReconnect ? (
            <ExpiredGreeting />
          ) : (
            <UserGreeting
              userName={pageAccount?.status === "signed_in" ? pageAccount.displayName : undefined}
              userImage={userImage}
            />
          )}
          <button
            onClick={logout}
            className="mt-3 w-full cursor-pointer rounded-md border-2 border-solid border-purple-500 bg-transparent px-3 py-1.5 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
          >
            Logout
          </button>
        </>
      ) : (
        <GuestGreeting />
      )}
    </div>
  );
};

export default Popup;
