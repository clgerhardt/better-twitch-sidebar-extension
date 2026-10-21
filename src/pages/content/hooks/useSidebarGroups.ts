import { messageLogger } from "@src/pages/utils/logger";
import {
  CHANNEL_GROUPS_KEY,
  CHANNEL_SNAPSHOT_KEY,
  PENDING_FOLLOWS_KEY,
  GROUP_NAMES_KEY,
  DEFAULT_GROUP_KEY,
  SNAPSHOT_ERROR_KEY,
} from "@src/pages/utils/constants";
import { useEffect, useRef, useState } from "react";
import { FetchedChannel, SidebarGroup, layoutGroups } from "@src/pages/utils/layoutGroups";
import { isSnapshotFor, snapshotToFetched, withPendingFollows } from "@src/pages/shared/twitch/snapshot";
import { MESSAGES } from "@src/pages/shared/messages";
import { LIVE_REFRESH_MS, LIVE_RETRY_MS, startLiveRefresh } from "@src/pages/shared/liveRefresh";

// The sidebar never talks to Twitch. The background fetches the followed channels into a stored
// snapshot; this hook shows that snapshot (instantly, if there is one), groups it with the user's
// groups, and asks the background to refresh it.
export const useSidebarGroups = (): {
  groups: SidebarGroup[];
  loading: boolean;
  error: string | null;
  // When the stored channel data was last refreshed (null while there is none)
  fetchedAt: number | null;
  channelGroups: Record<string, string>;
  setChannelGroups: (map: Record<string, string>) => void;
} => {
  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelGroups, setChannelGroups] = useState<Record<string, string>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  // The live refresh timer reads this, so it is always the latest value
  const fetchedAtRef = useRef<number | null>(null);
  // True while the account is connected but its first snapshot has not arrived
  const waitingForFirstRef = useRef(false);
  const updateFetchedAt = (value: number | null) => {
    fetchedAtRef.current = value;
    setFetchedAt(value);
  };

  // The channels of the current snapshot, kept so group edits can re-layout without reading it again
  const fetchedRef = useRef<FetchedChannel[] | null>(null);

  const applyLayout = () => {
    chrome.storage.local.get([CHANNEL_GROUPS_KEY, GROUP_NAMES_KEY, DEFAULT_GROUP_KEY], (stored) => {
      const result = layoutGroups({
        fetched: fetchedRef.current ?? [],
        groupNames: stored[GROUP_NAMES_KEY] || [],
        defaultGroup: stored[DEFAULT_GROUP_KEY],
        channelGroups: stored[CHANNEL_GROUPS_KEY] || {},
      });

      if (result.addedMappings) {
        chrome.storage.local.set({ [CHANNEL_GROUPS_KEY]: result.channelGroups });
      }

      setChannelGroups(result.channelGroups);
      setGroups(result.groups);
      setError(null);
    });
  };

  // Shows whatever the background has stored for the connected account
  const showStoredSnapshot = () => {
    chrome.storage.local.get(["twitchToken", "twitchUserId", CHANNEL_SNAPSHOT_KEY, PENDING_FOLLOWS_KEY, SNAPSHOT_ERROR_KEY], (stored) => {
      const { twitchToken, twitchUserId } = stored;
      waitingForFirstRef.current = false;
      if (!twitchToken || !twitchUserId) {
        // Logged out: drop the previous account's channels and groups from memory too
        fetchedRef.current = null;
        updateFetchedAt(null);
        setGroups([]);
        setLoading(false);
        setError("Missing Twitch credentials");
        return;
      }

      const snapshot = stored[CHANNEL_SNAPSHOT_KEY];
      if (isSnapshotFor(snapshot, twitchUserId)) {
        fetchedRef.current = snapshotToFetched(withPendingFollows(snapshot, stored[PENDING_FOLLOWS_KEY], Date.now()));
        updateFetchedAt(snapshot.fetchedAt);
        setLoading(false);
        applyLayout();
        return;
      }

      // Nothing stored for this account yet: wait for the first refresh, or say why it failed
      fetchedRef.current = null;
      updateFetchedAt(null);
      setGroups([]);
      const reason = stored[SNAPSHOT_ERROR_KEY];
      if (reason) {
        setError(reason === "unauthorized" ? "Twitch login expired. Please reconnect in the extension popup." : "Failed to fetch followed channels");
        setLoading(false);
      } else {
        setError(null);
        setLoading(true);
        waitingForFirstRef.current = true;
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
      } else if (changes[CHANNEL_SNAPSHOT_KEY] || changes[PENDING_FOLLOWS_KEY] || changes[SNAPSHOT_ERROR_KEY]) {
        showStoredSnapshot();
      } else if (changes[CHANNEL_GROUPS_KEY] || changes[GROUP_NAMES_KEY] || changes[DEFAULT_GROUP_KEY]) {
        if (fetchedRef.current) applyLayout();
      }
    };
    chrome.storage.onChanged.addListener(listener);

    // Keep live status and viewer counts fresh, but only while someone is looking at the tab
    const stopLiveRefresh = startLiveRefresh({
      intervalMs: LIVE_REFRESH_MS,
      retryMs: LIVE_RETRY_MS,
      request: requestRefresh,
      getFetchedAt: () => fetchedAtRef.current,
      isWaitingForFirst: () => waitingForFirstRef.current,
    });

    return () => {
      chrome.storage.onChanged.removeListener(listener);
      stopLiveRefresh();
    };
  }, []);

  return { groups, loading, error, fetchedAt, channelGroups, setChannelGroups };
};
