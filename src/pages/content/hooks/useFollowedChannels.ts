import { useState, useEffect } from 'react';
import {
  CHANNEL_GROUPS_KEY,
  CHANNEL_SNAPSHOT_KEY,
  GROUP_NAMES_KEY,
} from "@src/pages/utils/constants";
import { SidebarGroup, layoutGroups } from "@src/pages/utils/layoutGroups";
import { isSnapshotFor, snapshotToFetched } from "@src/pages/shared/twitch/snapshot";

// The groups the Manage Groups dialog shows: the stored channel snapshot laid out with the user's
// groups, exactly as the sidebar does. Read-only; the sidebar owns refreshing the snapshot.
const useFollowedChannels = () => {
  const [groups, setGroups] = useState<SidebarGroup[]>([]);

  useEffect(() => {
    const read = () =>
      chrome.storage.local
        .get(["twitchToken", "twitchUserId", CHANNEL_SNAPSHOT_KEY, GROUP_NAMES_KEY, CHANNEL_GROUPS_KEY])
        .then((stored) => {
          const snapshot = stored[CHANNEL_SNAPSHOT_KEY];
          if (!stored.twitchToken || !isSnapshotFor(snapshot, stored.twitchUserId)) {
            setGroups([]);
            return;
          }
          setGroups(
            layoutGroups({
              fetched: snapshotToFetched(snapshot),
              groupNames: stored[GROUP_NAMES_KEY] || [],
              channelGroups: stored[CHANNEL_GROUPS_KEY] || {},
            }).groups
          );
        })
        .catch((e) => console.error("Error reading groups", e));

    read();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local") return;
      if (changes.twitchToken || changes.twitchUserId || changes[CHANNEL_SNAPSHOT_KEY] || changes[GROUP_NAMES_KEY] || changes[CHANNEL_GROUPS_KEY]) read();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return groups;
};

export default useFollowedChannels;
