import React, { useEffect, useState } from "react";
import UserGreeting from "./UserGreeting/UserGreeting";
import GuestGreeting from "./GuestGreeting/GuestGreeting";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";
import { useTwitchToken } from "../content/hooks/userTwitchToken";

const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID;

type UserSession = {
  user: string;
  userImage: string;
};

const Popup = () => {
  const port = chrome.runtime.connect({ name: "popup" });
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isIncognito, setIsIncognito] = useState<boolean | null>(
    chrome.extension.inIncognitoContext
  );

  const twitchToken = useTwitchToken();

  const logout = () => {
    chrome.storage.local.remove("twitchToken", () => {
      setUserSession(null);
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
        setUserSession({ user, userImage });
        port.postMessage({ message: "SYS:User:LoggedIn", user });
        messageLogger(constants.location.POPUP, "Fetched Twitch user", user);
        chrome.storage.local.set({ twitchUserId: userData.id });
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
    messageLogger(constants.location.POPUP, "Popup loaded");
    messageLogger(
      constants.location.POPUP,
      "Checking if in incognito mode",
      isIncognito
    );
    messageLogger(constants.location.POPUP, "Twitch token:", twitchToken);
    if (twitchToken) {
      fetchTwitchUser(twitchToken);
    } else {
      setUserSession(null);
    }
  }, [twitchToken]);

  if (isIncognito) {
    return (
      <div id="main-container" className="p-4 text-sm text-gray-200">
        This extension does not work in Incognito Mode. Please disable it in
        your browser settings or use a normal window.
      </div>
    );
  }

  return (
    <div id="main-container" className="p-4 text-sm text-gray-200">
      {twitchToken ? (
        <>
          <UserGreeting
            userName={userSession?.user}
            userImage={userSession?.userImage}
          />
          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1 rounded mt-4"
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <GuestGreeting />
        </>
      )}
    </div>
  );
};

export default Popup;
