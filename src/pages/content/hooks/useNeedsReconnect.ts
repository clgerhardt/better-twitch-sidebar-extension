import { useEffect, useState } from "react";
import { SNAPSHOT_ERROR_KEY } from "../../utils/constants";

// True while Twitch rejects the extension's saved connection and the background could not renew it
export const useNeedsReconnect = () => {
  const [needsReconnect, setNeedsReconnect] = useState(false);

  useEffect(() => {
    const read = () =>
      chrome.storage.local.get(["twitchToken", SNAPSHOT_ERROR_KEY]).then((stored) => {
        setNeedsReconnect(!!stored.twitchToken && stored[SNAPSHOT_ERROR_KEY] === "unauthorized");
      });
    read();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && (changes.twitchToken || changes[SNAPSHOT_ERROR_KEY])) read();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return needsReconnect;
};
