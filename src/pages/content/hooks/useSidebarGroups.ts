import { messageLogger } from "@src/pages/utils/logger";
import { CHANNEL_GROUPS_KEY, FOLLOWED_CHANNELS_KEY, GROUP_NAMES_KEY } from "@src/pages/utils/constants";
import { useEffect, useRef, useState } from "react";

const TWITCH_API_BASE = "https://api.twitch.tv/helix";

export type SidebarChannel = {
  login: string;
  channelImage: string;
  channelLink: string;
  channelName: string;
  isLive: boolean;
  streamingContent?: string;
  viewerCount?: string;
};

export type SidebarGroup = {
  default: boolean;
  dialogOpen: boolean;
  dropdownVisible: boolean;
  followedChannels: SidebarChannel[];
  groupName: string;
  numberOfChannels: number;
  numberOfLiveChannels: number;
  order: number;
};

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
  const fetchedRef = useRef<{ login: string; channel: SidebarChannel }[] | null>(null);

  const applyLayout = () => {
    chrome.storage.local.get([CHANNEL_GROUPS_KEY, GROUP_NAMES_KEY], (stored) => {
      const fetched = fetchedRef.current ?? [];
      const groupNames: string[] = stored[GROUP_NAMES_KEY] || [];
      const updatedChannelGroups: Record<string, string> = stored[CHANNEL_GROUPS_KEY] || {};
      const groupMap: Record<string, SidebarChannel[]> = {};

      let didAddNewMapping = false;

      fetched.forEach(({ login, channel }) => {
        const groupName = updatedChannelGroups[login] || "Ungrouped";

        if (!updatedChannelGroups[login]) {
          updatedChannelGroups[login] = "Ungrouped";
          didAddNewMapping = true;
        }

        if (!groupMap[groupName]) groupMap[groupName] = [];
        groupMap[groupName].push(channel);
      });

      // Ungrouped first, then user-created groups in order (including empty ones),
      // then any group that only exists in the channel map
      const orderedNames = [
        "Ungrouped",
        ...groupNames,
        ...Object.keys(groupMap).filter((n) => n !== "Ungrouped" && !groupNames.includes(n)),
      ];

      const groupList: SidebarGroup[] = orderedNames.map((groupName, index) => {
        const channels = [...(groupMap[groupName] ?? [])];
        return {
          default: groupName === "Ungrouped",
          dialogOpen: false,
          dropdownVisible: false,
          followedChannels: channels.sort((a, b) => a.isLive === b.isLive ? 0 : a.isLive ? -1 : 1),
          groupName,
          numberOfChannels: channels.length,
          numberOfLiveChannels: channels.filter((c) => c.isLive).length,
          order: index,
        };
      });

      if (didAddNewMapping) {
        chrome.storage.local.set({ [CHANNEL_GROUPS_KEY]: updatedChannelGroups });
      }

      setChannelGroups(updatedChannelGroups);
      setGroups(groupList);
      setError(null);
      chrome.storage.local.set({ [FOLLOWED_CHANNELS_KEY]: groupList });
    });
  };

  const fetchChannels = async () => {
    chrome.storage.local.get(["twitchToken", "twitchUserId"], async ({ twitchToken, twitchUserId }) => {
      if (!twitchToken || !twitchUserId) {
        setLoading(false);
        setError("Missing Twitch credentials");
        return;
      }

      messageLogger("useSidebarGroups", "start fetching followed channels", performance.now());

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
        setError("Failed to fetch followed channels");
      } finally {
        messageLogger("useSidebarGroups", "total process time", performance.now());
        setLoading(false);
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

