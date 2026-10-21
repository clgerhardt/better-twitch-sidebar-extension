// The channel snapshot: what the background fetched from Twitch for one user, stored so every tab,
// the popup and the dialog read the same data. Pure functions only (no chrome.* or Vite imports).
import type { FetchedChannel } from "../../utils/layoutGroups";
import type { FollowedChannel, LiveStream, TwitchUser } from "./helix";

export const SNAPSHOT_VERSION = 1;

export type SnapshotChannel = {
  id: string;
  login: string;
  displayName: string;
  image: string;
  isLive: boolean;
  game: string;
  // Absent in snapshots stored before titles were fetched; the next live refresh fills it
  title?: string;
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
  live ? { isLive: true, game: live.game, title: live.title, viewers: live.viewers } : { isLive: false, game: "", title: "", viewers: 0 };

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
      viewers: c.isLive ? c.viewers : 0,
      streamingContent: c.isLive ? c.game : undefined,
      streamTitle: c.isLive && c.title ? c.title : undefined,
      viewerCount: c.isLive ? `${compact.format(c.viewers)} viewers` : undefined,
    },
  }));

// Twitch's followed list can lag behind a follow or an unfollow. A channel the user just followed is kept
// here, with what Twitch's public lookups said about it, and shown with the snapshot until the list
// includes it. A channel the user just unfollowed is kept in `removed`, and hidden until the list drops it.
export const PENDING_FOLLOW_MAX_AGE_MS = 15 * 60_000;
// An unfollow that Twitch's list still disagrees with this long afterwards is not believed (it may have failed)
export const PENDING_UNFOLLOW_MAX_AGE_MS = 3 * 60_000;

export type PendingFollows = {
  // The Twitch account these belong to, like the snapshot
  user: { id: string };
  items: { addedAt: number; channel: SnapshotChannel }[];
  removed?: { addedAt: number; login: string }[];
};

export const isPendingFor = (value: unknown, userId: string): value is PendingFollows => {
  const p = value as Partial<PendingFollows> | null | undefined;
  return !!p && typeof p === "object" && p.user?.id === userId && Array.isArray(p.items);
};

const stillPending = (item: PendingFollows["items"][number], followedIds: Set<string>, now: number) =>
  !followedIds.has(item.channel.id) && now - item.addedAt < PENDING_FOLLOW_MAX_AGE_MS;

const stillRemoved = (entry: { addedAt: number; login: string }, followedLogins: Set<string>, now: number) =>
  followedLogins.has(entry.login) && now - entry.addedAt < PENDING_UNFOLLOW_MAX_AGE_MS;

// The snapshot with the pending channels in front (most recent follow first), except those it already has,
// and without the channels that were just unfollowed
export const withPendingFollows = (snapshot: ChannelSnapshot, pending: unknown, now: number): ChannelSnapshot => {
  if (!isPendingFor(pending, snapshot.user.id)) return snapshot;
  const have = new Set(snapshot.channels.map((c) => c.id));
  const extra = pending.items
    .filter((item) => stillPending(item, have, now))
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((item) => item.channel);
  const hidden = new Set((pending.removed ?? []).filter((r) => now - r.addedAt < PENDING_UNFOLLOW_MAX_AGE_MS).map((r) => r.login));
  const channels = [...extra, ...snapshot.channels].filter((c) => !hidden.has(c.login.toLowerCase()));
  return extra.length === 0 && channels.length === snapshot.channels.length ? snapshot : { ...snapshot, channels };
};

// What stays pending once the follow list is known: follows it does not have yet, and unfollows it still
// shows, each only while believable. null when nothing is left.
export const prunePending = (pending: unknown, userId: string, follows: FollowedChannel[], now: number): PendingFollows | null => {
  if (!isPendingFor(pending, userId)) return null;
  const followedIds = new Set(follows.map((f) => f.id));
  const followedLogins = new Set(follows.map((f) => f.login.toLowerCase()));
  const items = pending.items.filter((item) => stillPending(item, followedIds, now));
  const removed = (pending.removed ?? []).filter((entry) => stillRemoved(entry, followedLogins, now));
  return items.length === 0 && removed.length === 0 ? null : { user: pending.user, items, ...(removed.length > 0 ? { removed } : {}) };
};

// A channel as the snapshot stores it, from a profile and (when live) its stream
export const channelFromLookup = (user: TwitchUser, stream: LiveStream | undefined): SnapshotChannel => ({
  id: user.id,
  login: user.login,
  displayName: user.displayName,
  image: user.image,
  ...liveFields(stream),
});
