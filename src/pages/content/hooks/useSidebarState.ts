import { useState, useEffect } from 'react';
import { getLocalStorage, setLocalStorage } from "@src/pages/background/storage";
import { constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";

const useSidebarState = (tabId: string) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  useEffect(() => {
    const fetchSidebarState = async () => {
      try {
        const sidebarState: any = await getLocalStorage(constants.storage.prefix + constants.storage.sideBarStateByTab) || {};
        setIsSidebarExpanded(sidebarState[tabId]?.sidebarExpanded || false);

        const manageGroupRoot = document.getElementById("__manage-groups-root");
        if (manageGroupRoot) {
          manageGroupRoot.style.height = sidebarState[tabId]?.sidebarExpanded ? "3.5rem" : "0rem";
        }

        messageLogger(constants.location.UI_COMPONENT, "sideBarState", sidebarState);
      } catch (e) {
        console.error("Error fetching sidebar state", e);
      }
    };

    fetchSidebarState();
  }, [tabId]);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key === constants.storage.prefix + constants.storage.sideBarStateByTab) {
          const manageGroupRoot = document.getElementById("__manage-groups-root");
          if (manageGroupRoot) {
            manageGroupRoot.style.height = newValue[tabId]?.sidebarExpanded ? "3.5rem" : "0rem";
          }
          setIsSidebarExpanded(newValue[tabId]?.sidebarExpanded || false);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [tabId]);

  return isSidebarExpanded;
};

export default useSidebarState;
