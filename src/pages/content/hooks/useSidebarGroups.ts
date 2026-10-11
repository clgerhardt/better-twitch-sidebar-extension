import { messageLogger } from "@src/pages/utils/logger";
import {
  CHANNEL_GROUPS_KEY,
  CHANNEL_SNAPSHOT_KEY,
  FOLLOWED_CHANNELS_KEY,
  GROUP_NAMES_KEY,
  SNAPSHOT_ERROR_KEY,
} from "@src/pages/utils/constants";
import { useEffect, useRef, useState } from "react";
import { FetchedChannel, SidebarGroup, layoutGroups } from "@src/pages/utils/layoutGroups";
import { isSnapshotFor, snapshotToFetched } from "@src/pages/shared/twitch/snapshot";
import { MESSAGES } from "@src/pages/shared/messages";

// The sidebar never talks to Twitch. The background fetches the followed channels into a stored
// snapshot; this hook shows that snapshot (instantly, if there is one), groups it with the user's
// groups, and asks the background to refresh it.
export const useSidebarGroups = (): {
  groups: SidebarGroup[];
  loading: boolean;
  error: string | null;
  channelGroups: Record<string, string>;
  setChannelGroups: (map: Record<string, string>) => void;
} => {
  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelGroups, setChannelGroups] = useState<Record<string, string>>({});

  // The channels of the current snapshot, kept so group edits can re-layout without reading it again
  const fetchedRef = useRef<FetchedChannel[] | null>(null);

  const applyLayout = () => {
    chrome.storage.local.get([CHANNEL_GROUPS_KEY, GROUP_NAMES_KEY], (stored) => {
      const result = layoutGroups({
        fetched: fetchedRef.current ?? [],
        groupNames: stored[GROUP_NAMES_KEY] || [],
        channelGroups: stored[CHANNEL_GROUPS_KEY] || {},
      });

      if (result.addedMappings) {
        chrome.storage.local.set({ [CHANNEL_GROUPS_KEY]: result.channelGroups });
      }

      setChannelGroups(result.channelGroups);
      setGroups(result.groups);
      setError(null);
      chrome.storage.local.set({ [FOLLOWED_CHANNELS_KEY]: result.groups });
    });
  };

  // Shows whatever the background has stored for the connected account
  const showStoredSnapshot = () => {
    chrome.storage.local.get(["twitchToken", "twitchUserId", CHANNEL_SNAPSHOT_KEY, SNAPSHOT_ERROR_KEY], (stored) => {
      const { twitchToken, twitchUserId } = stored;
      if (!twitchToken || !twitchUserId) {
        // Logged out: drop the previous account's channels and groups from memory too
        fetchedRef.current = null;
        setGroups([]);
        setLoading(false);
        setError("Missing Twitch credentials");
        return;
      }

      const snapshot = stored[CHANNEL_SNAPSHOT_KEY];
      if (isSnapshotFor(snapshot, twitchUserId)) {
        fetchedRef.current = snapshotToFetched(snapshot);
        setLoading(false);
        applyLayout();
        return;
      }

      // Nothing stored for this account yet: wait for the first refresh, or say why it failed
      fetchedRef.current = null;
      setGroups([]);
      const reason = stored[SNAPSHOT_ERROR_KEY];
      if (reason) {
        setError(reason === "unauthorized" ? "Twitch login expired. Please reconnect in the extension popup." : "Failed to fetch followed channels");
        setLoading(false);
      } else {
        setError(null);
        setLoading(true);
      }
    });
  };

  const requestRefresh = () => {
    chrome.runtime.sendMessage({ type: MESSAGES.REFRESH_CHANNELS }).catch((error) => {
      messageLogger("useSidebarGroups", "could not reach the background", error);
    });
  };

  useEffect(() => {
    showStoredSnapshot();
    requestRefresh();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== "local") return;
      if (changes.twitchToken || changes.twitchUserId) {
        showStoredSnapshot();
        requestRefresh();
      } else if (changes[CHANNEL_SNAPSHOT_KEY] || changes[SNAPSHOT_ERROR_KEY]) {
        showStoredSnapshot();
      } else if (changes[CHANNEL_GROUPS_KEY] || changes[GROUP_NAMES_KEY]) {
        if (fetchedRef.current) applyLayout();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return { groups, loading, error, channelGroups, setChannelGroups };
};
