import { useState, useEffect } from 'react';
import { getLocalStorage } from "@src/pages/background/storage";
import { CHANNEL_GROUP_MAP, constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";

const useChannelGroupMap = () => {
  const [channelGroupMap, setChannelGroupMap] = useState<any>({});

  useEffect(() => {
    const fetchFollowedChannels = async () => {
      try {
        const channelsMap: any = await getLocalStorage(CHANNEL_GROUP_MAP) || {};
        setChannelGroupMap(channelsMap);
        messageLogger(constants.location.UI_COMPONENT, "channelsGroupMap", channelsMap);
      } catch (e) {
        console.error("Error fetching channel group map", e);
      }
    };

    fetchFollowedChannels();
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key === CHANNEL_GROUP_MAP) {
          setChannelGroupMap(newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return channelGroupMap;
};

export default useChannelGroupMap;
