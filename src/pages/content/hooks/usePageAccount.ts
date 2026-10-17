import { useEffect, useState } from "react";
import { PAGE_ACCOUNT_KEY } from "../../utils/constants";
import type { StoredPageAccount } from "../../shared/twitch/guestMessage";

// The Twitch account signed in on twitch.tv, as last seen by a Twitch tab (undefined before any was opened)
export const usePageAccount = () => {
  const [account, setAccount] = useState<StoredPageAccount | undefined>();

  useEffect(() => {
    chrome.storage.local.get(PAGE_ACCOUNT_KEY).then((stored) => setAccount(stored[PAGE_ACCOUNT_KEY]));
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes[PAGE_ACCOUNT_KEY]) setAccount(changes[PAGE_ACCOUNT_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return account;
};
