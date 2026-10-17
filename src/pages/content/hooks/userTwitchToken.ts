import { useEffect, useState } from "react";
import { getValidTwitchToken } from "../utils/getValidTwitchToken";
import { messageLogger } from "@src/pages/utils/logger";
import { constants } from "@src/pages/utils/constants";

export function useTwitchToken() {
  const [token, setToken] = useState<string | null>(null);

  const updateToken = async () => {
    const validToken = await getValidTwitchToken();
    messageLogger(constants.location.HOOK, "[HOOK] Checking for valid Twitch token: " + validToken);
    setToken(validToken);
  };

  useEffect(() => {
    updateToken(); // Run immediately on mount

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.twitchToken) {
        messageLogger(constants.location.HOOK, "[HOOK] twitchToken changed in storage");
        updateToken();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return token;
}
