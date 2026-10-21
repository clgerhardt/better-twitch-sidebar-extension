// What happens when the user follows or unfollows a channel on twitch.tv. Twitch's followed list can lag behind, so
// the list is fetched fresh, and when the channel is still missing it is looked up directly and kept as
// "pending" (shown in the sidebar) until the list includes it. An unfollowed channel is hidden at once
// and stays hidden until the list drops it. Storage, the Helix client and the clock are injected, so
// the rules are tested in plain node.
import { CHANNEL_SNAPSHOT_KEY, PENDING_FOLLOWS_KEY } from "../../utils/constants";
import type { HelixClient } from "./helix";
import type { RefreshResult, RefreshStorage } from "./refresh";
import { channelFromLookup, isPendingFor, isSnapshotFor, type PendingFollows } from "./snapshot";

// Twitch records the follow a moment after the click; asking at once would only find the old list
export const FOLLOW_SETTLE_MS = 1_500;

export type FollowOutcome = { found: boolean };
export type UnfollowOutcome = { gone: boolean };

type Deps = {
  client: Pick<HelixClient, "getUserByLogin" | "getStreams">;
  storage: RefreshStorage;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  // Fetches the follow list now (the refresher with refreshFollows on)
  refreshFollows: () => Promise<RefreshResult>;
  log?: (message: string, detail?: unknown) => void;
};

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const createFollowHandler = (deps: Deps) => {
  const { client, storage, now, log } = deps;

  const followedLogins = async (userId: string): Promise<Set<string>> => {
    const stored = await storage.get([CHANNEL_SNAPSHOT_KEY]);
    const snapshot = stored[CHANNEL_SNAPSHOT_KEY];
    return new Set(isSnapshotFor(snapshot, userId) ? snapshot.channels.map((c) => c.login.toLowerCase()) : []);
  };

  const readPending = async (userId: string): Promise<PendingFollows> => {
    const current = (await storage.get([PENDING_FOLLOWS_KEY]))[PENDING_FOLLOWS_KEY];
    return isPendingFor(current, userId) ? current : { user: { id: userId }, items: [] };
  };

  // Writes the pending changes, or removes the entry when there are none
  const writePending = async (pending: PendingFollows) => {
    const removed = pending.removed ?? [];
    if (pending.items.length === 0 && removed.length === 0) await storage.remove([PENDING_FOLLOWS_KEY]);
    else await storage.set({ [PENDING_FOLLOWS_KEY]: { user: pending.user, items: pending.items, ...(removed.length > 0 ? { removed } : {}) } });
  };

  return {
    // The user pressed Unfollow. The channel is hidden at once; then the follow list is fetched fresh, and it
    // stays hidden until the list drops it (a few minutes at most, see PENDING_UNFOLLOW_MAX_AGE_MS).
    onUnfollow: async (login: string, displayName?: string): Promise<UnfollowOutcome> => {
      const stored = await storage.get(["twitchToken", "twitchUserId", CHANNEL_SNAPSHOT_KEY]);
      const userId: string | undefined = stored.twitchUserId;
      if (!stored.twitchToken || !userId) return { gone: true };

      // Which channel the button is for: the address's own, or (on a page that is not) the one with the button's name
      const known = isSnapshotFor(stored[CHANNEL_SNAPSHOT_KEY], userId) ? stored[CHANNEL_SNAPSHOT_KEY].channels : [];
      const target =
        known.find((c) => c.login.toLowerCase() === login.toLowerCase() && (!displayName || sameName(c.displayName, displayName)))?.login ??
        (displayName ? known.find((c) => sameName(c.displayName, displayName))?.login : undefined) ??
        login;
      const key = target.toLowerCase();

      const pending = await readPending(userId);
      await writePending({
        user: pending.user,
        items: pending.items.filter((item) => item.channel.login.toLowerCase() !== key),
        removed: [...(pending.removed ?? []).filter((r) => r.login !== key), { addedAt: now(), login: key }],
      });

      await deps.sleep(FOLLOW_SETTLE_MS);
      await deps.refreshFollows();
      return { gone: !(await followedLogins(userId)).has(key) };
    },

    // login comes from the page's address; displayName from the Follow button, to catch a page that is
    // not that channel's own (a video of another channel, for example)
    onFollow: async (login: string, displayName?: string): Promise<FollowOutcome> => {
      const stored = await storage.get(["twitchToken", "twitchUserId"]);
      const token: string | undefined = stored.twitchToken;
      const userId: string | undefined = stored.twitchUserId;
      if (!token || !userId) return { found: false };

      // Following a channel that was just unfollowed: it is no longer to be hidden
      const before = await readPending(userId);
      if ((before.removed ?? []).some((r) => r.login === login.toLowerCase())) {
        await writePending({ ...before, removed: (before.removed ?? []).filter((r) => r.login !== login.toLowerCase()) });
      }

      await deps.sleep(FOLLOW_SETTLE_MS);
      await deps.refreshFollows();
      if ((await followedLogins(userId)).has(login.toLowerCase())) return { found: true };

      try {
        // The channel the button is for: by the address first, then by the button's own name
        const lookup = async (name: string) => {
          const found = await client.getUserByLogin(token, name);
          return found && (!displayName || sameName(found.displayName, displayName)) ? found : null;
        };
        const user = (await lookup(login)) ?? (displayName && !sameName(displayName, login) ? await lookup(displayName.toLowerCase()) : null);
        if (!user) return { found: false };
        // Followed after all while we were looking?
        if ((await followedLogins(userId)).has(user.login.toLowerCase())) return { found: true };

        const [stream] = await client.getStreams(token, [user.id]);
        const channel = channelFromLookup(user, stream);
        const current = await readPending(userId);
        await writePending({ ...current, items: [...current.items.filter((item) => item.channel.id !== channel.id), { addedAt: now(), channel }] });
        log?.(`followed list has not caught up with ${user.login}: showing it until it does`);
      } catch (error) {
        log?.("could not look up the followed channel", error);
      }
      return { found: false };
    },
  };
};
