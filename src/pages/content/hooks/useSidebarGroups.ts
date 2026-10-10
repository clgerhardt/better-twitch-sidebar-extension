import { messageLogger } from "@src/pages/utils/logger";
import { CHANNEL_GROUPS_KEY, FOLLOWED_CHANNELS_KEY, GROUP_NAMES_KEY } from "@src/pages/utils/constants";
import { useEffect, useRef, useState } from "react";
import { FetchedChannel, SidebarGroup, layoutGroups } from "@src/pages/utils/layoutGroups";

const TWITCH_API_BASE = "https://api.twitch.tv/helix";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const fetchChunked = async (
  baseUrl: string,
  headers: any,
  paramKey: string,
  ids: string[]
) => {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) {
    const idParams = ids
      .slice(i, i + 100)
      .map((id) => `${paramKey}=${id}`)
      .join("&");
    const res = await fetch(`${baseUrl}?${idParams}`, { headers });

    if (res.status === 429) {
      await delay(1000);
      i -= 100;
      continue;
    }

    chunks.push(...(await res.json()).data);
    await delay(250);
  }
  return chunks;
};

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

  // Followed channels from the Twitch API, kept so group edits can re-layout without refetching
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

  // Each fetch gets a number; a fetch that is no longer the latest (the user logged out, or another
  // account connected) must not write its results, or the previous account's channels reappear
  const fetchGeneration = useRef(0);

  const fetchChannels = async () => {
    const generation = ++fetchGeneration.current;
    const isStale = () => generation !== fetchGeneration.current;

    chrome.storage.local.get(["twitchToken", "twitchUserId"], async ({ twitchToken, twitchUserId }) => {
      if (isStale()) return;
      if (!twitchToken || !twitchUserId) {
        // Logged out: drop the previous account's channels and groups from memory too
        fetchedRef.current = null;
        setGroups([]);
        setLoading(false);
        setError("Missing Twitch credentials");
        return;
      }

      messageLogger("useSidebarGroups", "start fetching followed channels", performance.now());

      // Connected, so show loading (not the logged-out intro left over from the previous error)
      fetchedRef.current = null;
      setGroups([]);
      setError(null);
      setLoading(true);

      const headers = {
        Authorization: `Bearer ${twitchToken}`,
        "Client-Id": import.meta.env.VITE_TWITCH_CLIENT_ID,
      };

      try {
        let cursor;
        let followRes: any[] = [];
        do {
          const url = new URL(`${TWITCH_API_BASE}/channels/followed`);
          url.searchParams.set("user_id", twitchUserId);
          url.searchParams.set("first", "100");
          if (cursor) url.searchParams.set("after", cursor);

          const res = await fetch(url.toString(), { headers });
          const data = await res.json();
          if (isStale()) return;
          followRes = [...followRes, ...data.data];
          cursor = data.pagination?.cursor || null;
        } while (cursor);

        const followedIds = followRes.map((f: any) => f.broadcaster_id);

        if (!followedIds.length) {
          fetchedRef.current = [];
          applyLayout();
          return;
        }

        const usersRes = await fetchChunked(`${TWITCH_API_BASE}/users`, headers, "id", followedIds);
        const streamsRes = await fetchChunked(`${TWITCH_API_BASE}/streams`, headers, "user_id", followedIds);
        if (isStale()) return;

        const liveMap = new Map(
          streamsRes.map((s: any) => [
            s.user_id,
            {
              streamingContent: s.game_name,
              viewerCount: `${Intl.NumberFormat("en", { notation: "compact" }).format(s.viewer_count)} viewers`,
            },
          ])
        );

        fetchedRef.current = usersRes.map((u: any) => {
          const liveInfo = liveMap.get(u.id);
          return {
            login: u.login,
            channel: {
              login: u.login,
              channelImage: u.profile_image_url,
              channelLink: `https://twitch.tv/${u.display_name}`,
              channelName: u.display_name,
              isLive: !!liveInfo,
              streamingContent: liveInfo?.streamingContent,
              viewerCount: liveInfo?.viewerCount,
            },
          };
        });
        applyLayout();
      } catch (err) {
        if (!isStale()) setError("Failed to fetch followed channels");
      } finally {
        messageLogger("useSidebarGroups", "total process time", performance.now());
        if (!isStale()) setLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchChannels();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== "local") return;
      if (changes.twitchToken || changes.twitchUserId) {
        console.log("[HOOK] twitchToken or twitchUserId changed in storage");
        fetchChannels();
      } else if (changes[CHANNEL_GROUPS_KEY] || changes[GROUP_NAMES_KEY]) {
        if (fetchedRef.current) applyLayout();
        else fetchChannels();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return { groups, loading, error, channelGroups, setChannelGroups };
};

