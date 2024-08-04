import { useState, useEffect } from 'react';
import { getLocalStorage } from "@src/pages/background/storage";
import { constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";

const useFollowedChannels = () => {
  const [followedChannels, setFollowedChannels] = useState<any[]>([]);

  useEffect(() => {
    const fetchFollowedChannels = async () => {
      try {
        const channels: any = await getLocalStorage(constants.storage.localStorageKey) || [];
        setFollowedChannels(channels);
        messageLogger(constants.location.UI_COMPONENT, "followedChannels", channels);
      } catch (e) {
        console.error("Error fetching followed channels", e);
      }
    };

    fetchFollowedChannels();
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key === constants.storage.localStorageKey) {
          setFollowedChannels(newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return followedChannels;
};

export default useFollowedChannels;
