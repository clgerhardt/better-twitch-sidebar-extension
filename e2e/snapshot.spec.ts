import { test, expect } from "@playwright/test";
import {
  applyLive,
  avatarsFrom,
  buildSnapshot,
  idsNeedingAvatars,
  isSnapshotFor,
  snapshotToFetched,
  type ChannelSnapshot,
} from "../src/pages/shared/twitch/snapshot";

const follows = [
  { id: "1", login: "a", displayName: "Alpha" },
  { id: "2", login: "b", displayName: "Beta" },
  { id: "3", login: "c", displayName: "Gamma" },
];
const live = [{ id: "2", login: "b", displayName: "Beta", game: "Tarkov", viewers: 1500 }];

const snapshot = (): ChannelSnapshot =>
  buildSnapshot({ userId: "999", follows, avatars: { "1": "https://img/1.png", "2": "https://img/2.png" }, live, fetchedAt: 5_000, staticAt: 4_000 });

test.describe("buildSnapshot", () => {
  test("keeps the follow order and merges avatars and live status", () => {
    const s = snapshot();
    expect(s.version).toBe(1);
    expect(s.user).toEqual({ id: "999" });
    expect(s.fetchedAt).toBe(5_000);
    expect(s.staticAt).toBe(4_000);
    expect(s.channels).toEqual([
      { id: "1", login: "a", displayName: "Alpha", image: "https://img/1.png", isLive: false, game: "", viewers: 0 },
      { id: "2", login: "b", displayName: "Beta", image: "https://img/2.png", isLive: true, game: "Tarkov", viewers: 1500 },
      { id: "3", login: "c", displayName: "Gamma", image: "", isLive: false, game: "", viewers: 0 },
    ]);
  });
});

test.describe("applyLive", () => {
  test("updates live status, game and viewers, keeping avatars and the static timestamp", () => {
    const updated = applyLive(snapshot(), [{ id: "1", login: "a", displayName: "Alpha", game: "Zomboid", viewers: 20 }], 9_000);
    expect(updated.fetchedAt).toBe(9_000);
    expect(updated.staticAt).toBe(4_000);
    expect(updated.channels.map((c) => [c.login, c.isLive, c.game, c.viewers])).toEqual([
      ["a", true, "Zomboid", 20],
      ["b", false, "", 0], // went offline
      ["c", false, "", 0],
    ]);
    expect(updated.channels[0].image).toBe("https://img/1.png");
  });

  test("ignores live streams for channels that are not in the snapshot", () => {
    const updated = applyLive(snapshot(), [{ id: "42", login: "x", displayName: "X", game: "G", viewers: 1 }], 9_000);
    expect(updated.channels).toHaveLength(3);
    expect(updated.channels.some((c) => c.login === "x")).toBe(false);
  });

  test("does not modify the snapshot it was given", () => {
    const original = snapshot();
    applyLive(original, [], 9_000);
    expect(original).toEqual(snapshot());
  });
});

test.describe("avatars", () => {
  test("avatarsFrom reuses the images of the same user's snapshot", () => {
    expect(avatarsFrom(snapshot(), "999")).toEqual({ "1": "https://img/1.png", "2": "https://img/2.png" });
  });

  test("avatarsFrom never reuses another account's snapshot", () => {
    expect(avatarsFrom(snapshot(), "123")).toEqual({});
    expect(avatarsFrom(undefined, "999")).toEqual({});
  });

  test("idsNeedingAvatars lists only the channels without a known image", () => {
    expect(idsNeedingAvatars(follows, { "1": "https://img/1.png" })).toEqual(["2", "3"]);
    expect(idsNeedingAvatars(follows, {})).toEqual(["1", "2", "3"]);
  });
});

test.describe("isSnapshotFor", () => {
  test("accepts a valid snapshot of the user", () => {
    expect(isSnapshotFor(snapshot(), "999")).toBe(true);
  });

  test("rejects another user's snapshot, other versions and garbage", () => {
    expect(isSnapshotFor(snapshot(), "123")).toBe(false);
    expect(isSnapshotFor({ ...snapshot(), version: 2 }, "999")).toBe(false);
    expect(isSnapshotFor({ ...snapshot(), channels: "nope" }, "999")).toBe(false);
    for (const bad of [undefined, null, 5, "x", [], {}]) expect(isSnapshotFor(bad, "999")).toBe(false);
  });
});

test.describe("snapshotToFetched", () => {
  test("adapts live and offline channels to what the sidebar layout expects", () => {
    const [offline, online, noAvatar] = snapshotToFetched(snapshot());
    expect(offline).toEqual({
      login: "a",
      channel: { login: "a", channelName: "Alpha", channelLink: "https://twitch.tv/Alpha", channelImage: "https://img/1.png", isLive: false, viewers: 0, streamingContent: undefined, viewerCount: undefined },
    });
    expect(online.channel).toMatchObject({ isLive: true, streamingContent: "Tarkov", viewerCount: "1.5K viewers", viewers: 1500 });
    expect(noAvatar.channel.channelImage).toBe("");
  });

  test("formats viewer counts compactly", () => {
    const s = applyLive(snapshot(), [
      { id: "1", login: "a", displayName: "Alpha", game: "G", viewers: 7 },
      { id: "3", login: "c", displayName: "Gamma", game: "G", viewers: 1_250_000 },
    ], 1);
    const counts = snapshotToFetched(s).map((f) => f.channel.viewerCount);
    expect(counts).toEqual(["7 viewers", undefined, "1.3M viewers"]);
  });
});
