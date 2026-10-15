import { useEffect, useState } from "react";

// The connected account's profile picture, saved when it connected (undefined until it is read)
export const useStoredUserImage = () => {
  const [image, setImage] = useState<string | undefined>();

  useEffect(() => {
    chrome.storage.local.get("twitchUserImage").then((stored) => setImage(stored.twitchUserImage || undefined));
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes.twitchUserImage) setImage(changes.twitchUserImage.newValue || undefined);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return image;
};
