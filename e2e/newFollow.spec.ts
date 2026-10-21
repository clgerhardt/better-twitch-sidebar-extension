import { test, expect } from "@playwright/test";
import { createFollowHandler, FOLLOW_SETTLE_MS } from "../src/pages/shared/twitch/newFollow";
import { createRefresher, MIN_REFRESH_AGE_MS, type RefreshStorage } from "../src/pages/shared/twitch/refresh";
import {
  buildSnapshot,
  channelFromLookup,
  PENDING_FOLLOW_MAX_AGE_MS,
  PENDING_UNFOLLOW_MAX_AGE_MS,
  prunePending,
  withPendingFollows,
  type PendingFollows,
  type SnapshotChannel,
} from "../src/pages/shared/twitch/snapshot";

const memoryStorage = (initial: Record<string, any> = {}) => {
  const data: Record<string, any> = { ...initial };
  const storage: RefreshStorage = {
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => void keys.forEach((k) => delete data[k]),
  };
  return { storage, data };
};

const channel = (id: string, login: string, over: Partial<SnapshotChannel> = {}): SnapshotChannel => ({
  id, login, displayName: login.toUpperCase(), image: `https://img/${id}.png`, isLive: false, game: "", viewers: 0, ...over,
});
const snapshotOf = (...channels: SnapshotChannel[]) => buildSnapshot({
  userId: "999", follows: channels.map((c) => ({ id: c.id, login: c.login, displayName: c.displayName })), avatars: {}, live: [], fetchedAt: 1, staticAt: 1,
});
const pendingOf = (now: number, ...items: [SnapshotChannel, number][]): PendingFollows => ({ user: { id: "999" }, items: items.map(([c, age]) => ({ channel: c, addedAt: now - age })) });

test.describe("pending follows", () => {
  const now = 10_000_000;

  test("are shown in front of the snapshot, the most recent follow first", () => {
    const merged = withPendingFollows(snapshotOf(channel("1", "a")), pendingOf(now, [channel("2", "b"), 5_000], [channel("3", "c"), 1_000]), now);
    expect(merged.channels.map((c) => c.login)).toEqual(["c", "b", "a"]);
  });

  test("leave out channels the snapshot already has, old ones, and another account's", () => {
    const base = snapshotOf(channel("1", "a"));
    expect(withPendingFollows(base, pendingOf(now, [channel("1", "a"), 1_000]), now)).toBe(base);
    expect(withPendingFollows(base, pendingOf(now, [channel("2", "b"), PENDING_FOLLOW_MAX_AGE_MS + 1]), now)).toBe(base);
    expect(withPendingFollows(base, { ...pendingOf(now, [channel("2", "b"), 1_000]), user: { id: "other" } }, now)).toBe(base);
    expect(withPendingFollows(base, undefined, now)).toBe(base);
  });

  test("are pruned once the follow list has the channel, or they are too old", () => {
    const pending = pendingOf(now, [channel("2", "b"), 1_000], [channel("3", "c"), 2_000], [channel("4", "d"), PENDING_FOLLOW_MAX_AGE_MS + 1]);
    const kept = prunePending(pending, "999", [{ id: "2", login: "b", displayName: "B" }], now);
    expect(kept?.items.map((i) => i.channel.login)).toEqual(["c"]);
    expect(prunePending(pending, "999", [{ id: "2", login: "b", displayName: "B" }, { id: "3", login: "c", displayName: "C" }], now)).toBeNull();
    expect(prunePending(pending, "other", [], now)).toBeNull();
  });

  test("an unfollowed channel is hidden from the snapshot, for a few minutes at most", () => {
    const base = snapshotOf(channel("1", "a"), channel("2", "b"));
    const removed = (age: number): PendingFollows => ({ user: { id: "999" }, items: [], removed: [{ login: "b", addedAt: now - age }] });
    expect(withPendingFollows(base, removed(1_000), now).channels.map((c) => c.login)).toEqual(["a"]);
    expect(withPendingFollows(base, removed(PENDING_UNFOLLOW_MAX_AGE_MS + 1), now)).toBe(base);
  });

  test("an unfollow stays pending while the list still has the channel, and ends when it drops it or is too old", () => {
    const entry = (login: string, age: number) => ({ login, addedAt: now - age });
    const pending: PendingFollows = { user: { id: "999" }, items: [], removed: [entry("b", 1_000), entry("c", 1_000), entry("d", PENDING_UNFOLLOW_MAX_AGE_MS + 1)] };
    const list = [{ id: "2", login: "b", displayName: "B" }, { id: "4", login: "d", displayName: "D" }];
    expect(prunePending(pending, "999", list, now)?.removed?.map((r) => r.login)).toEqual(["b"]);
    expect(prunePending(pending, "999", [], now)).toBeNull();
  });

  test("a lookup becomes a snapshot channel, live when it has a stream", () => {
    const user = { id: "7", login: "new", displayName: "New", image: "https://img/7.png" };
    expect(channelFromLookup(user, undefined)).toEqual({ id: "7", login: "new", displayName: "New", image: "https://img/7.png", isLive: false, game: "", title: "", viewers: 0 });
    expect(channelFromLookup(user, { id: "7", login: "new", displayName: "New", game: "G", title: "T", viewers: 12 })).toMatchObject({ isLive: true, game: "G", title: "T", viewers: 12 });
  });
});

test.describe("the follow handler", () => {
  const connected = { twitchToken: "tok", twitchUserId: "999" };
  const newUser = { id: "7", login: "newchan", displayName: "NewChan", image: "https://img/7.png" };

  // refreshAdds: what the fresh follow list contains after the click
  const setup = (opts: { stored?: Record<string, any>; listHasIt?: boolean; user?: typeof newUser | null; users?: Record<string, typeof newUser>; stream?: any } = {}) => {
    const mem = memoryStorage({ ...(opts.stored ?? connected), channelSnapshot: snapshotOf(channel("1", "a")) });
    const calls: string[] = [];
    const sleeps: number[] = [];
    const handler = createFollowHandler({
      client: {
        getUserByLogin: async (_t, login) => (calls.push(`user:${login}`), opts.users ? opts.users[login] ?? null : opts.user === undefined ? newUser : opts.user),
        getStreams: async (_t, ids) => (calls.push(`streams:${ids.join(",")}`), opts.stream ? [opts.stream] : []),
      },
      storage: mem.storage,
      now: () => 5_000,
      sleep: async (ms) => void sleeps.push(ms),
      refreshFollows: async () => {
        calls.push("refreshFollows");
        if (opts.listHasIt) mem.data.channelSnapshot = snapshotOf(channel("1", "a"), channel("7", "newchan"));
        return { ok: true };
      },
    });
    return { handler, calls, sleeps, data: mem.data };
  };

  test("waits a moment, fetches the follow list fresh, and is done when it has the channel", async () => {
    const t = setup({ listHasIt: true });
    expect(await t.handler.onFollow("newchan", "NewChan")).toEqual({ found: true });
    expect(t.sleeps).toEqual([FOLLOW_SETTLE_MS]);
    expect(t.calls).toEqual(["refreshFollows"]);
    expect(t.data.pendingFollows).toBeUndefined();
  });

  test("when the list lags, looks the channel up and keeps it as pending, with its stream if it is live", async () => {
    const t = setup({ stream: { id: "7", login: "newchan", displayName: "NewChan", game: "G", title: "Hello", viewers: 30 } });
    expect(await t.handler.onFollow("newchan", "NewChan")).toEqual({ found: false });
    expect(t.calls).toEqual(["refreshFollows", "user:newchan", "streams:7"]);
    expect(t.data.pendingFollows.user).toEqual({ id: "999" });
    expect(t.data.pendingFollows.items).toEqual([{ addedAt: 5_000, channel: expect.objectContaining({ id: "7", login: "newchan", isLive: true, title: "Hello", viewers: 30 }) }]);
  });

  test("an offline channel is pending too", async () => {
    const t = setup();
    await t.handler.onFollow("newchan", "NewChan");
    expect(t.data.pendingFollows.items[0].channel).toMatchObject({ id: "7", isLive: false });
  });

  test("a page that is not the channel's own (the name differs) falls back to the button's name", async () => {
    const t = setup({ users: { videos: { ...newUser, id: "8", login: "videos", displayName: "Videos" }, newchan: newUser } });
    // the address says "videos" (a video page), but the button is for NewChan
    await t.handler.onFollow("videos", "NewChan");
    expect(t.calls.filter((c) => c.startsWith("user:"))).toEqual(["user:videos", "user:newchan"]);
    expect(t.data.pendingFollows.items.map((i: any) => i.channel.login)).toEqual(["newchan"]);
  });

  test("when neither lookup is the button's channel nothing is added", async () => {
    const t = setup({ users: { videos: { ...newUser, id: "8", login: "videos", displayName: "Videos" } } });
    await t.handler.onFollow("videos", "NewChan");
    expect(t.data.pendingFollows).toBeUndefined();
  });

  test("following the same channel again replaces its pending entry instead of duplicating it", async () => {
    const t = setup({ stored: { ...connected, pendingFollows: pendingOf(1_000, [channel("7", "newchan"), 0]) } });
    await t.handler.onFollow("newchan", "NewChan");
    expect(t.data.pendingFollows.items).toHaveLength(1);
    expect(t.data.pendingFollows.items[0].addedAt).toBe(5_000);
  });

  test("an unknown channel adds nothing", async () => {
    const t = setup({ user: null });
    expect(await t.handler.onFollow("nobody")).toEqual({ found: false });
    expect(t.data.pendingFollows).toBeUndefined();
  });

  test("when not connected nothing happens", async () => {
    const t = setup({ stored: {} });
    expect(await t.handler.onFollow("newchan")).toEqual({ found: false });
    expect(t.calls).toEqual([]);
    expect(t.sleeps).toEqual([]);
  });
});

test.describe("the unfollow handler", () => {
  const connected = { twitchToken: "tok", twitchUserId: "999" };

  // stillListed: whether the fresh follow list still has the channel
  const setup = (opts: { stored?: Record<string, any>; stillListed?: boolean } = {}) => {
    const mem = memoryStorage({ ...(opts.stored ?? connected), channelSnapshot: snapshotOf(channel("1", "a"), channel("2", "b", { displayName: "Bee" })) });
    const sleeps: number[] = [];
    let hiddenDuringRefresh: unknown;
    const handler = createFollowHandler({
      client: { getUserByLogin: async () => null, getStreams: async () => [] },
      storage: mem.storage,
      now: () => 5_000,
      sleep: async (ms) => void sleeps.push(ms),
      refreshFollows: async () => {
        hiddenDuringRefresh = JSON.parse(JSON.stringify(mem.data.pendingFollows ?? null));
        if (!opts.stillListed) mem.data.channelSnapshot = snapshotOf(channel("1", "a"));
        return { ok: true };
      },
    });
    return { handler, data: mem.data, sleeps, hiddenDuringRefresh: () => hiddenDuringRefresh };
  };

  test("hides the channel at once, before the fresh list is fetched, and is done when the list drops it", async () => {
    const t = setup();
    expect(await t.handler.onUnfollow("b", "Bee")).toEqual({ gone: true });
    expect(t.hiddenDuringRefresh()).toMatchObject({ removed: [{ login: "b", addedAt: 5_000 }] });
    expect(t.sleeps).toEqual([FOLLOW_SETTLE_MS]);
  });

  test("when the list still has the channel it stays hidden, and the caller is told to ask again", async () => {
    const t = setup({ stillListed: true });
    expect(await t.handler.onUnfollow("b", "Bee")).toEqual({ gone: false });
    expect(t.data.pendingFollows.removed).toEqual([{ login: "b", addedAt: 5_000 }]);
  });

  test("a pending follow of the same channel is dropped", async () => {
    const t = setup({ stored: { ...connected, pendingFollows: pendingOf(1_000, [channel("9", "z"), 0], [channel("8", "y"), 0]) } });
    await t.handler.onUnfollow("z");
    expect(t.data.pendingFollows.items.map((i: any) => i.channel.login)).toEqual(["y"]);
  });

  test("a page that is not the channel's own hides the channel with the button's name", async () => {
    const t = setup({ stillListed: true });
    await t.handler.onUnfollow("videos", "Bee");
    expect(t.data.pendingFollows.removed).toEqual([{ login: "b", addedAt: 5_000 }]);
  });

  test("following a channel again ends its hiding", async () => {
    const t = setup({ stored: { ...connected, pendingFollows: { user: { id: "999" }, items: [], removed: [{ login: "b", addedAt: 1_000 }] } }, stillListed: true });
    await t.handler.onFollow("b", "Bee");
    expect(t.data.pendingFollows).toBeUndefined();
  });

  test("when not connected nothing happens", async () => {
    const t = setup({ stored: {} });
    expect(await t.handler.onUnfollow("b")).toEqual({ gone: true });
    expect(t.data.pendingFollows).toBeUndefined();
    expect(t.sleeps).toEqual([]);
  });
});

test.describe("refreshing the follow list on demand", () => {
  const follows = [{ id: "1", login: "a", displayName: "A" }];
  const setup = (stored: Record<string, any>) => {
    const mem = memoryStorage({ twitchToken: "tok", twitchUserId: "999", twitchUserImage: "https://img/me.png", ...stored });
    const calls: string[] = [];
    const client = {
      getFollowedChannels: async () => (calls.push("followed"), { total: 1, channels: follows }),
      getUsers: async (_t: string, ids: string[]) => (ids.length > 0 && calls.push("users"), ids.map((id) => ({ id, login: id, displayName: id, image: "https://img" }))),
      getLiveFollowed: async () => (calls.push("live"), []),
    };
    return { refresher: createRefresher({ client, storage: mem.storage, now: () => 1_000_000 }), calls, data: mem.data };
  };
  const recent = () => buildSnapshot({ userId: "999", follows, avatars: { "1": "https://img/1.png" }, live: [], fetchedAt: 1_000_000 - MIN_REFRESH_AGE_MS - 1, staticAt: 1_000_000 - 60_000 });

  test("a recent follow list is not fetched again, unless asked to", async () => {
    const plain = setup({ channelSnapshot: recent() });
    await plain.refresher.refresh(true);
    expect(plain.calls).toEqual(["live"]);

    const asked = setup({ channelSnapshot: recent() });
    await asked.refresher.refresh(true, true);
    expect(asked.calls).toEqual(["followed", "live"]);
  });

  test("channels the fresh list includes stop being pending, the others stay", async () => {
    const t = setup({ channelSnapshot: recent(), pendingFollows: pendingOf(1_000_000, [channel("1", "a"), 1_000], [channel("9", "z"), 1_000]) });
    await t.refresher.refresh(true, true);
    expect(t.data.pendingFollows.items.map((i: any) => i.channel.login)).toEqual(["z"]);
  });

  test("the pending entry is removed altogether when nothing is left", async () => {
    const t = setup({ channelSnapshot: recent(), pendingFollows: pendingOf(1_000_000, [channel("1", "a"), 1_000]) });
    await t.refresher.refresh(true, true);
    expect(t.data.pendingFollows).toBeUndefined();
  });
});
