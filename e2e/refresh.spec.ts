import { test, expect } from "@playwright/test";
import { createRefresher, MIN_REFRESH_AGE_MS, STATIC_MAX_AGE_MS, type RefreshStorage } from "../src/pages/shared/twitch/refresh";
import { HelixError } from "../src/pages/shared/twitch/helix";
import { buildSnapshot } from "../src/pages/shared/twitch/snapshot";

const follows = [
  { id: "1", login: "a", displayName: "Alpha" },
  { id: "2", login: "b", displayName: "Beta" },
];

const memoryStorage = (initial: Record<string, any> = {}) => {
  const data: Record<string, any> = { ...initial };
  const storage: RefreshStorage = {
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => void keys.forEach((k) => delete data[k]),
  };
  return { storage, data };
};

const connected = { twitchToken: "tok", twitchUserId: "999" };

// A fake client that records calls; each method can be overridden per test
const fakeClient = (overrides: Record<string, (...args: any[]) => any> = {}) => {
  const calls: string[] = [];
  const client = {
    getFollowedChannels: async (...args: any[]) => (calls.push("followed"), overrides.getFollowedChannels?.(...args) ?? { total: 2, channels: follows }),
    getUsers: async (token: string, ids: string[]) => (
      calls.push(`users:${ids.join(",")}`),
      overrides.getUsers?.(token, ids) ?? ids.map((id) => ({ id, login: `l${id}`, displayName: `L${id}`, image: `https://img/${id}.png` }))
    ),
    getLiveFollowed: async (...args: any[]) => (calls.push("live"), overrides.getLiveFollowed?.(...args) ?? [{ id: "2", login: "b", displayName: "Beta", game: "G", viewers: 10 }]),
  };
  return { client, calls };
};

const setup = (
  stored: Record<string, any> = connected,
  overrides: Record<string, (...args: any[]) => any> = {},
  start = 1_000_000,
  renewToken?: (data: Record<string, any>) => Promise<string | null>,
  isPaused?: () => Promise<boolean>
) => {
  let time = start;
  const mem = memoryStorage(stored);
  const { client, calls } = fakeClient(overrides);
  const refresher = createRefresher({ client, storage: mem.storage, now: () => time, renewToken: renewToken && (() => renewToken(mem.data)), isPaused });
  return { refresher, calls, data: mem.data, advance: (ms: number) => (time += ms), now: () => time };
};

const existingSnapshot = (fetchedAt: number, staticAt: number, userId = "999") =>
  buildSnapshot({ userId, follows, avatars: { "1": "https://img/1.png", "2": "https://img/2.png" }, live: [], fetchedAt, staticAt });

test.describe("refresh", () => {
  test("a first refresh fetches follows, avatars and live status and stores a snapshot for the user", async () => {
    const t = setup();
    const result = await t.refresher.refresh();
    expect(result).toMatchObject({ ok: true });
    expect(t.calls).toEqual(["followed", "users:1,2", "live"]);
    const snapshot = t.data.channelSnapshot;
    expect(snapshot.user).toEqual({ id: "999" });
    expect(snapshot.fetchedAt).toBe(t.now());
    expect(snapshot.staticAt).toBe(t.now());
    expect(snapshot.channels.map((c: any) => [c.login, c.image, c.isLive])).toEqual([
      ["a", "https://img/1.png", false],
      ["b", "https://img/2.png", true],
    ]);
    expect(t.data.snapshotError).toBeUndefined();
  });

  test("when not connected nothing is fetched or written", async () => {
    const t = setup({});
    expect(await t.refresher.refresh()).toEqual({ ok: false, reason: "not_connected" });
    expect(t.calls).toEqual([]);
    expect(t.data.channelSnapshot).toBeUndefined();
  });

  test("a recent snapshot is only refreshed for live status, not for follows or avatars", async () => {
    const start = 1_000_000;
    const t = setup({ ...connected, channelSnapshot: existingSnapshot(start - MIN_REFRESH_AGE_MS - 1, start - 60_000) }, {}, start);
    await t.refresher.refresh();
    expect(t.calls).toEqual(["live"]);
    expect(t.data.channelSnapshot.staticAt).toBe(start - 60_000);
    expect(t.data.channelSnapshot.fetchedAt).toBe(start);
    expect(t.data.channelSnapshot.channels.find((c: any) => c.login === "b").isLive).toBe(true);
  });

  test("a very fresh snapshot is not refreshed unless forced", async () => {
    const start = 1_000_000;
    const t = setup({ ...connected, channelSnapshot: existingSnapshot(start - 1_000, start - 1_000) }, {}, start);
    expect(await t.refresher.refresh()).toMatchObject({ ok: true, skipped: true });
    expect(t.calls).toEqual([]);
    await t.refresher.refresh(true);
    expect(t.calls).toEqual(["live"]);
  });

  test("an old follow list is refreshed, and only new channels cost a profile lookup", async () => {
    const start = 10_000_000;
    const t = setup(
      { ...connected, channelSnapshot: existingSnapshot(start - 60_000, start - STATIC_MAX_AGE_MS - 1) },
      { getFollowedChannels: () => ({ total: 3, channels: [...follows, { id: "3", login: "c", displayName: "Gamma" }] }) },
      start
    );
    await t.refresher.refresh();
    expect(t.calls).toEqual(["followed", "users:3", "live"]);
    expect(t.data.channelSnapshot.channels.map((c: any) => c.image)).toEqual(["https://img/1.png", "https://img/2.png", "https://img/3.png"]);
    expect(t.data.channelSnapshot.staticAt).toBe(start);
  });

  test("another account's snapshot is ignored and replaced", async () => {
    const start = 1_000_000;
    const t = setup({ ...connected, channelSnapshot: existingSnapshot(start - 60_000, start - 1_000, "someone-else") }, {}, start);
    await t.refresher.refresh();
    expect(t.calls).toEqual(["followed", "users:1,2", "live"]); // nothing reused
    expect(t.data.channelSnapshot.user.id).toBe("999");
  });

  test("concurrent refreshes share one fetch", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = setup(connected, { getLiveFollowed: async () => (await gate, []) });
    const first = t.refresher.refresh();
    const second = t.refresher.refresh(true);
    release();
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
    expect(t.calls.filter((c) => c === "followed")).toHaveLength(1);
  });

  test("a refresh in flight when the user logs out is discarded", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = setup(connected, { getLiveFollowed: async () => (await gate, []) });
    const pending = t.refresher.refresh();
    await new Promise((r) => setTimeout(r, 0));
    delete t.data.twitchToken; // logout
    delete t.data.twitchUserId;
    release();
    expect(await pending).toEqual({ ok: false, reason: "discarded" });
    expect(t.data.channelSnapshot).toBeUndefined();
  });

  test("a refresh in flight when another account connects is discarded", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = setup(connected, { getLiveFollowed: async () => (await gate, []) });
    const pending = t.refresher.refresh();
    await new Promise((r) => setTimeout(r, 0));
    t.data.twitchUserId = "another-user";
    t.data.twitchToken = "another-token";
    release();
    expect(await pending).toEqual({ ok: false, reason: "discarded" });
    expect(t.data.channelSnapshot).toBeUndefined();
  });

  test("failures keep the old snapshot and record why", async () => {
    const start = 1_000_000;
    const old = existingSnapshot(start - 60_000, start - 60_000);
    for (const [error, reason] of [
      [new HelixError("unauthorized", "x", 401), "unauthorized"],
      [new HelixError("rate_limited", "x", 429), "rate_limited"],
      [new HelixError("network", "x"), "failed"],
      [new HelixError("http", "x", 500), "failed"],
      [new Error("bug"), "failed"],
    ] as const) {
      const t = setup({ ...connected, channelSnapshot: old }, { getLiveFollowed: () => Promise.reject(error) }, start);
      expect(await t.refresher.refresh()).toEqual({ ok: false, reason });
      expect(t.data.snapshotError).toBe(reason);
      expect(t.data.channelSnapshot).toEqual(old);
    }
  });

  test("a later success clears the error, and a failure does not block the next attempt", async () => {
    const start = 1_000_000;
    let fail = true;
    const t = setup({ ...connected, channelSnapshot: existingSnapshot(start - 60_000, start - 60_000) }, {
      getLiveFollowed: () => (fail ? Promise.reject(new HelixError("network", "x")) : []),
    }, start);
    await t.refresher.refresh();
    expect(t.data.snapshotError).toBe("failed");
    fail = false;
    expect(await t.refresher.refresh(true)).toMatchObject({ ok: true });
    expect(t.data.snapshotError).toBeUndefined();
  });

  test("a failure after the user logged out is not recorded", async () => {
    let fail!: (e: Error) => void;
    const gate = new Promise<never>((_, reject) => (fail = reject));
    const t = setup(connected, { getLiveFollowed: () => gate });
    const pending = t.refresher.refresh();
    await new Promise((r) => setTimeout(r, 0));
    delete t.data.twitchToken;
    delete t.data.twitchUserId;
    fail(new HelixError("unauthorized", "x", 401));
    expect(await pending).toEqual({ ok: false, reason: "discarded" });
    expect(t.data.snapshotError).toBeUndefined();
  });

  test("nothing is fetched or recorded while paused (signed out of Twitch)", async () => {
    let paused = true;
    const t = setup(connected, {}, 1_000_000, undefined, async () => paused);
    expect(await t.refresher.refresh(true)).toEqual({ ok: false, reason: "paused" });
    expect(t.calls).toEqual([]);
    expect(t.data.channelSnapshot).toBeUndefined();
    expect(t.data.snapshotError).toBeUndefined();

    paused = false;
    expect(await t.refresher.refresh(true)).toMatchObject({ ok: true });
  });

  test.describe("a rejected token", () => {
    const rejectOldToken = (renewedFails = false) => ({
      getFollowedChannels: async (token: string) => {
        if (renewedFails || token === "tok") throw new HelixError("unauthorized", "x", 401);
        return { total: 2, channels: follows };
      },
    });

    test("is renewed once and the refresh is retried with the new token", async () => {
      let renewals = 0;
      const used: string[] = [];
      const t = setup(connected, {
        ...rejectOldToken(),
        getLiveFollowed: async (token: string) => (used.push(token), []),
      }, 1_000_000, async (data) => {
        renewals++;
        data.twitchToken = "renewed";
        return "renewed";
      });
      expect(await t.refresher.refresh()).toMatchObject({ ok: true });
      expect(renewals).toBe(1);
      expect(used).toEqual(["renewed"]);
      expect(t.data.channelSnapshot.channels).toHaveLength(2);
      expect(t.data.snapshotError).toBeUndefined();
    });

    test("is reported as unauthorized when it cannot be renewed", async () => {
      let renewals = 0;
      const t = setup(connected, rejectOldToken(), 1_000_000, async () => (renewals++, null));
      expect(await t.refresher.refresh()).toEqual({ ok: false, reason: "unauthorized" });
      expect(renewals).toBe(1);
      expect(t.data.snapshotError).toBe("unauthorized");
    });

    test("is not renewed in a loop when the new token is rejected too", async () => {
      let renewals = 0;
      const t = setup(connected, rejectOldToken(true), 1_000_000, async (data) => (renewals++, (data.twitchToken = "renewed")));
      expect(await t.refresher.refresh()).toEqual({ ok: false, reason: "unauthorized" });
      expect(renewals).toBe(1);
      expect(t.data.snapshotError).toBe("unauthorized");
    });

    test("is not renewed after the user logged out meanwhile", async () => {
      let renewals = 0;
      const t = setup(connected, {
        getFollowedChannels: async () => {
          delete t.data.twitchToken;
          delete t.data.twitchUserId;
          throw new HelixError("unauthorized", "x", 401);
        },
      }, 1_000_000, async () => (renewals++, "renewed"));
      expect(await t.refresher.refresh()).toEqual({ ok: false, reason: "discarded" });
      expect(renewals).toBe(0);
    });
  });
});
