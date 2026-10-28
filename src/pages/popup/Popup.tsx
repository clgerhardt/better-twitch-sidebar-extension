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
import { useT } from "../shared/i18n/store";

const Popup = () => {
  const [isIncognito, setIsIncognito] = useState<boolean | null>(
    chrome.extension.inIncognitoContext
  );

  const twitchToken = useTwitchToken();
  const pageAccount = usePageAccount();
  const needsReconnect = useNeedsReconnect();
  const userImage = useStoredUserImage();
  const t = useT();

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
        <p className="mb-0 mt-3">{t("popup.incognito")}</p>
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
            {t("popup.logout")}
          </button>
        </>
      ) : (
        <GuestGreeting />
      )}
    </div>
  );
};

export default Popup;
