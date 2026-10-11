// The channel snapshot: what the background fetched from Twitch for one user, stored so every tab,
// the popup and the dialog read the same data. Pure functions only (no chrome.* or Vite imports).
import type { FetchedChannel } from "../../utils/layoutGroups";
import type { FollowedChannel, LiveStream } from "./helix";

export const SNAPSHOT_VERSION = 1;

export type SnapshotChannel = {
  id: string;
  login: string;
  displayName: string;
  image: string;
  isLive: boolean;
  game: string;
  viewers: number;
};

export type ChannelSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  // The Twitch account this data belongs to. A snapshot is never shown to another account.
  user: { id: string };
  // When the live data was last refreshed, and when the follow list and avatars were
  fetchedAt: number;
  staticAt: number;
  // In follow order (most recent follow first)
  channels: SnapshotChannel[];
};

const liveFields = (live: LiveStream | undefined) =>
  live ? { isLive: true, game: live.game, viewers: live.viewers } : { isLive: false, game: "", viewers: 0 };

export const buildSnapshot = (input: {
  userId: string;
  follows: FollowedChannel[];
  avatars: Record<string, string>;
  live: LiveStream[];
  fetchedAt: number;
  staticAt: number;
}): ChannelSnapshot => {
  const liveById = new Map(input.live.map((l) => [l.id, l]));
  return {
    version: SNAPSHOT_VERSION,
    user: { id: input.userId },
    fetchedAt: input.fetchedAt,
    staticAt: input.staticAt,
    channels: input.follows.map((f) => ({
      id: f.id,
      login: f.login,
      displayName: f.displayName,
      image: input.avatars[f.id] ?? "",
      ...liveFields(liveById.get(f.id)),
    })),
  };
};

// A live-only refresh: same channels and avatars, new live status. Streams for channels that are
// not in the snapshot are ignored (the follow list is refreshed on its own schedule).
export const applyLive = (snapshot: ChannelSnapshot, live: LiveStream[], fetchedAt: number): ChannelSnapshot => {
  const liveById = new Map(live.map((l) => [l.id, l]));
  return {
    ...snapshot,
    fetchedAt,
    channels: snapshot.channels.map((c) => ({ ...c, ...liveFields(liveById.get(c.id)) })),
  };
};

export const isSnapshotFor = (value: unknown, userId: string): value is ChannelSnapshot => {
  const s = value as Partial<ChannelSnapshot> | null | undefined;
  return !!s && typeof s === "object" && s.version === SNAPSHOT_VERSION && s.user?.id === userId && Array.isArray(s.channels);
};

// Avatars already known for this user, so only new channels need a profile lookup
export const avatarsFrom = (snapshot: unknown, userId: string): Record<string, string> => {
  if (!isSnapshotFor(snapshot, userId)) return {};
  const avatars: Record<string, string> = {};
  for (const c of snapshot.channels) if (c.image) avatars[c.id] = c.image;
  return avatars;
};

export const idsNeedingAvatars = (follows: FollowedChannel[], avatars: Record<string, string>): string[] =>
  follows.filter((f) => !avatars[f.id]).map((f) => f.id);

const compact = new Intl.NumberFormat("en", { notation: "compact" });

// The shape the sidebar layout expects (see layoutGroups)
export const snapshotToFetched = (snapshot: ChannelSnapshot): FetchedChannel[] =>
  snapshot.channels.map((c) => ({
    login: c.login,
    channel: {
      login: c.login,
      channelName: c.displayName,
      channelLink: `https://twitch.tv/${c.displayName}`,
      channelImage: c.image,
      isLive: c.isLive,
      streamingContent: c.isLive ? c.game : undefined,
      viewerCount: c.isLive ? `${compact.format(c.viewers)} viewers` : undefined,
    },
  }));
