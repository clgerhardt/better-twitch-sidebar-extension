import { useState, useEffect } from 'react';
import { getLocalStorage } from "@src/pages/background/storage";
import { GLOBAL_STATE_KEY, constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";

const useGlobalState = () => {
  const [globalState, setGlobalState] = useState<any>({});

  useEffect(() => {
    const fetchGlobalState = async () => {
      try {
        const globalState: any = await getLocalStorage(GLOBAL_STATE_KEY) || {};
        setGlobalState(globalState);
        messageLogger(constants.location.UI_COMPONENT, "global state", globalState);
      } catch (e) {
        console.error("Error fetching global state", e);
      }
    };

    fetchGlobalState();
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key === GLOBAL_STATE_KEY) {
          setGlobalState(newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return globalState;
};

export default useGlobalState;