import { test, expect } from "@playwright/test";
import { canonicalize, hashState, isEmptyState, threeWayMerge, unionMerge, type GroupsState, type RawGroups } from "../src/pages/shared/groupsSync/groupsState";
import { chunkKey, coreKey, decodeState, encodeState, MAX_ITEM_BYTES, MAX_TOTAL_BYTES, metaKey, type Meta } from "../src/pages/shared/groupsSync/remoteFormat";
import { createGroupsSync, type RemoteStore, type SyncBase } from "../src/pages/shared/groupsSync/groupsSync";

const state = (over: Partial<RawGroups> = {}): GroupsState => canonicalize({ groupNames: [], channelGroups: {}, ...over });

test.describe("canonical groups", () => {
  test("the default group is implied, entries in it are dropped, colors must be valid and belong to a group", () => {
    const s = canonicalize({
      groupNames: ["Gym", "Gym", "Work"],
      defaultGroup: "Ungrouped",
      channelGroups: { b: "Gym", a: "Ungrouped", c: "Elsewhere" },
      groupColors: { Gym: "#EF4444", Work: "red", Ghost: "#22c55e" },
    });
    expect(s.groupNames).toEqual(["Ungrouped", "Gym", "Work", "Elsewhere"]); // default first; a group only a channel uses still exists
    expect(s.channelGroups).toEqual({ b: "Gym", c: "Elsewhere" });
    expect(s.groupColors).toEqual({ Gym: "#ef4444" });
  });

  test("the default group keeps its place in the order when the order lists it", () => {
    expect(canonicalize({ groupNames: ["A", "Ungrouped", "B"] }).groupNames).toEqual(["A", "Ungrouped", "B"]);
  });

  test("the same groups hash the same whatever order they were stored in, and any change changes the hash", async () => {
    const a = canonicalize({ groupNames: ["A", "B"], channelGroups: { x: "A", y: "B" }, groupColors: { A: "#ef4444", B: "#22c55e" } });
    const b = canonicalize({ groupNames: ["A", "B"], channelGroups: { y: "B", x: "A", z: "Ungrouped" }, groupColors: { B: "#22c55e", A: "#ef4444" } });
    expect(await hashState(a)).toBe(await hashState(b));
    expect(await hashState(a)).toMatch(/^[0-9a-f]{64}$/);
    for (const changed of [
      canonicalize({ groupNames: ["B", "A"], channelGroups: { x: "A", y: "B" }, groupColors: { A: "#ef4444", B: "#22c55e" } }),
      canonicalize({ groupNames: ["A", "B"], channelGroups: { x: "B", y: "B" }, groupColors: { A: "#ef4444", B: "#22c55e" } }),
      canonicalize({ groupNames: ["A", "B"], channelGroups: { x: "A", y: "B" }, groupColors: { A: "#ef4444" } }),
      canonicalize({ groupNames: ["A", "B"], defaultGroup: "A", channelGroups: { x: "A", y: "B" }, groupColors: { A: "#ef4444", B: "#22c55e" } }),
    ]) expect(await hashState(changed)).not.toBe(await hashState(a));
  });

  test("a fresh install has nothing worth sharing", () => {
    expect(isEmptyState(canonicalize({}))).toBe(true);
    expect(isEmptyState(canonicalize({ groupNames: ["A"] }))).toBe(false);
    expect(isEmptyState(canonicalize({ defaultGroup: "Inbox" }))).toBe(false);
    expect(isEmptyState(canonicalize({ groupColors: { Ungrouped: "#ef4444" } }))).toBe(false);
  });
});

test.describe("merging", () => {
  const base = state({ groupNames: ["A", "B"], channelGroups: { x: "A", y: "B", z: "A" } });

  test("changes to different channels on both sides are both kept", () => {
    const local = state({ groupNames: ["A", "B"], channelGroups: { x: "B", y: "B", z: "A" } });
    const remote = state({ groupNames: ["A", "B"], channelGroups: { x: "A", y: "B", z: "Ungrouped" } });
    expect(threeWayMerge(base, local, remote).channelGroups).toEqual({ x: "B", y: "B" });
  });

  test("a channel changed differently on both sides takes the remote value", () => {
    const local = state({ groupNames: ["A", "B"], channelGroups: { x: "B", y: "B", z: "A" } });
    const remote = state({ groupNames: ["A", "B", "C"], channelGroups: { x: "C", y: "B", z: "A" } });
    expect(threeWayMerge(base, local, remote).channelGroups.x).toBe("C");
  });

  test("groups added on both sides are all kept, and a group removed on one side is gone", () => {
    const local = state({ groupNames: ["A", "L"], channelGroups: { x: "A", z: "A" } }); // removed B, added L
    const remote = state({ groupNames: ["A", "B", "R"], channelGroups: { x: "A", y: "B", z: "A" } }); // added R
    const merged = threeWayMerge(base, local, remote);
    expect(merged.groupNames).toEqual(["Ungrouped", "A", "R", "L"]);
    expect(merged.channelGroups).toEqual({ x: "A", z: "A" }); // y went back to the default group on this side
  });

  test("a group someone else still used is not lost: the channels keep it", () => {
    // this side renamed A to A2; the other side moved a channel into A
    const local = state({ groupNames: ["A2", "B"], channelGroups: { x: "A2", y: "B", z: "A2" } });
    const remote = state({ groupNames: ["A", "B"], channelGroups: { x: "A", y: "A", z: "A" } });
    const merged = threeWayMerge(base, local, remote);
    expect(merged.groupNames).toContain("A"); // y still points at it
    expect(merged.channelGroups.y).toBe("A");
  });

  test("colors merge per group, and the default group can change on one side", () => {
    const b = state({ groupNames: ["A", "B"], groupColors: { A: "#ef4444" } });
    const local = state({ groupNames: ["A", "B"], groupColors: { A: "#ef4444", B: "#22c55e" } });
    const remote = state({ groupNames: ["A", "B"], defaultGroup: "B", groupColors: { A: "#3b82f6" } });
    const merged = threeWayMerge(b, local, remote);
    expect(merged.groupColors).toEqual({ A: "#3b82f6", B: "#22c55e" });
    expect(merged.defaultGroup).toBe("B");
  });

  test("when only one side changed, the result is that side", () => {
    const changed = state({ groupNames: ["A", "B", "C"], channelGroups: { x: "C" } });
    expect(threeWayMerge(base, base, changed)).toEqual(changed);
    expect(threeWayMerge(base, changed, base)).toEqual(changed);
  });

  test("the first sync keeps both devices' groups, the remote's assignments win, and local ones the remote lacks stay", () => {
    const remote = state({ groupNames: ["R1", "R2"], defaultGroup: "R1", channelGroups: { p: "R2", q: "R2" }, groupColors: { R2: "#ef4444" } });
    const localRaw: RawGroups = { groupNames: ["L1"], channelGroups: { q: "L1", r: "L1", s: "Ungrouped" }, groupColors: { L1: "#22c55e", R2: "#3b82f6" } };
    const merged = unionMerge(localRaw, remote);
    expect(merged.groupNames).toEqual(["R1", "R2", "L1", "Ungrouped"]);
    expect(merged.defaultGroup).toBe("R1");
    expect(merged.channelGroups).toEqual({ p: "R2", q: "R2", r: "L1", s: "Ungrouped" }); // q: remote wins; s stays in this device's old default group
    expect(merged.groupColors).toEqual({ L1: "#22c55e", R2: "#ef4444" });
  });
});

test.describe("the remote format", () => {
  const big = (channels: number, groups: number): GroupsState =>
    canonicalize({
      groupNames: Array.from({ length: groups }, (_, i) => `Group number ${i}`),
      channelGroups: Object.fromEntries(Array.from({ length: channels }, (_, i) => [`some_channel_${i}`, `Group number ${i % groups}`])),
    });
  const bytes = (key: string, value: unknown) => new TextEncoder().encode(key + JSON.stringify(value)).length;

  test("a state round-trips, in chunks that each fit an item and that fit the quota together", async () => {
    const s = big(3000, 12);
    const encoded = encodeState("999", s, 1, "A", await hashState(s));
    expect(encoded.meta.chunks).toBeGreaterThan(1);
    for (const [key, value] of Object.entries(encoded.items)) expect(bytes(key, value)).toBeLessThanOrEqual(MAX_ITEM_BYTES);
    expect(encoded.bytes).toBeLessThan(MAX_TOTAL_BYTES);
    expect(decodeState("999", encoded.meta, encoded.items)).toEqual(s);
  });

  test("an empty channel map needs no chunks, and unicode group names survive", async () => {
    const s = canonicalize({ groupNames: ["Игры", "友達"], groupColors: { 友達: "#22c55e" } });
    const encoded = encodeState("999", s, 1, "A", await hashState(s));
    expect(encoded.meta.chunks).toBe(0);
    expect(decodeState("999", encoded.meta, encoded.items)).toEqual(s);
  });

  test("a reader that sees only part of a write gets nothing", async () => {
    const s = big(2000, 3);
    const encoded = encodeState("999", s, 1, "A", await hashState(s));
    const { [chunkKey("999", 1)]: _lost, ...partial } = encoded.items;
    expect(decodeState("999", encoded.meta, partial)).toBeNull();
    const { [coreKey("999")]: _core, ...noCore } = encoded.items;
    expect(decodeState("999", encoded.meta, noCore)).toBeNull();
  });
});

// A fake chrome.storage.sync shared by the devices, which counts the writes
const makeRemote = () => {
  const data: Record<string, unknown> = {};
  const stats = { sets: 0, removes: 0 };
  let beforeGet: ((keys: string[]) => Promise<void>) | null = null;
  const store: RemoteStore = {
    get: async (keys) => {
      if (beforeGet) {
        const hook = beforeGet;
        beforeGet = null; // once
        await hook(keys);
      }
      return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
    },
    set: async (items) => (stats.sets++, void Object.assign(data, structuredClone(items))),
    remove: async (keys) => (stats.removes++, void keys.forEach((k) => delete data[k])),
  };
  return { store, data, stats, onNextGet: (fn: (keys: string[]) => Promise<void>) => (beforeGet = fn) };
};

// A device: its own local groups, its own base, and a connection to the shared remote
const makeDevice = (remote: ReturnType<typeof makeRemote>, id: string, options: { userId?: () => string | undefined } = {}) => {
  const local: RawGroups = {};
  let base: SyncBase | null = null;
  let enabled = true;
  const sync = createGroupsSync({
    remote: remote.store,
    userId: async () => (options.userId ? options.userId() : "999"),
    enabled: async () => enabled,
    readLocal: async () => structuredClone(local),
    writeLocal: async (s) => void Object.assign(local, structuredClone({ groupNames: s.groupNames, defaultGroup: s.defaultGroup, groupColors: s.groupColors, channelGroups: s.channelGroups })),
    readBase: async () => structuredClone(base),
    writeBase: async (b) => void (base = structuredClone(b)),
    deviceId: async () => id,
  });
  return { local, run: sync.run, setEnabled: (value: boolean) => (enabled = value), base: () => base };
};

const view = (d: { local: RawGroups }) => canonicalize(d.local);

test.describe("syncing devices", () => {
  test("nothing is written for a device with nothing to share", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    expect(await a.run()).toEqual({ done: "nothing_to_share" });
    expect(remote.stats.sets).toBe(0);
  });

  test("one device's groups reach another, and syncing again changes nothing (no echo)", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: { x: "Gym", y: "Ungrouped" }, groupColors: { Gym: "#ef4444" } });
    expect(await a.run()).toEqual({ done: "pushed" });
    expect(await b.run()).toEqual({ done: "first_sync" });
    expect(view(b)).toEqual(view(a));

    const writes = remote.stats.sets;
    expect(await a.run()).toEqual({ done: "in_step" });
    expect(await b.run()).toEqual({ done: "in_step" });
    expect(remote.stats.sets).toBe(writes);
    expect((remote.data[metaKey("999")] as Meta).rev).toBe(1);
  });

  test("a later change on one device is pulled by the other, and the revision counts up", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: { x: "Gym" } });
    await a.run();
    await b.run();

    a.local.channelGroups = { x: "Gym", y: "Gym" };
    expect(await a.run()).toEqual({ done: "pushed" });
    expect(await b.run()).toEqual({ done: "pulled" });
    expect(view(b).channelGroups).toEqual({ x: "Gym", y: "Gym" });
    expect((remote.data[metaKey("999")] as Meta).rev).toBe(2);
  });

  test("edits to different channels made on two devices before they sync are both kept, and both end up the same", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["G1", "G2"], channelGroups: { x: "G1", y: "G1" } });
    await a.run();
    await b.run();

    a.local.channelGroups = { x: "G2", y: "G1" }; // device A is offline when it edits
    b.local.channelGroups = { x: "G1", y: "G2" };
    expect(await b.run()).toEqual({ done: "pushed" });
    expect(await a.run()).toEqual({ done: "merged" });
    expect(await b.run()).toEqual({ done: "pulled" });
    expect(view(a).channelGroups).toEqual({ x: "G2", y: "G2" });
    expect(view(b)).toEqual(view(a));
    expect(await a.run()).toEqual({ done: "in_step" });
  });

  test("the same channel moved to different groups on two devices ends in the same place on both", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["G1", "G2", "G3"], channelGroups: { x: "G1" } });
    await a.run();
    await b.run();
    a.local.channelGroups = { x: "G2" };
    b.local.channelGroups = { x: "G3" };
    await b.run();
    await a.run();
    await b.run();
    expect(view(a)).toEqual(view(b));
    expect(view(a).channelGroups.x).toBe("G3"); // the one that reached the remote first wins
  });

  test("a device that changed groups while the remote moved on mid-push merges first instead of overwriting", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["G1", "G2"], channelGroups: { x: "G1", y: "G1" } });
    await a.run();
    await b.run();

    a.local.channelGroups = { x: "G2", y: "G1" };
    b.local.channelGroups = { x: "G1", y: "G2" };
    // While A is about to push, B's push lands (A's second look at the header sees it)
    let reads = 0;
    const racing = remote.store.get;
    remote.store.get = async (keys) => {
      if (keys.includes(metaKey("999")) && ++reads === 2) await b.run();
      return racing(keys);
    };
    await a.run();
    remote.store.get = racing;
    await b.run();
    expect(view(a).channelGroups).toEqual({ x: "G2", y: "G2" });
    expect(view(b)).toEqual(view(a));
  });

  test("the first sync of a device that already has groups keeps them and adds the synced ones", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const c = makeDevice(remote, "C");
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: { x: "Gym" }, groupColors: { Gym: "#ef4444" } });
    await a.run();
    Object.assign(c.local, { groupNames: ["Work"], channelGroups: { w: "Work", x: "Work" } });
    expect(await c.run()).toEqual({ done: "first_sync" });
    expect(view(c).groupNames).toEqual(["Ungrouped", "Gym", "Work"]);
    expect(view(c).channelGroups).toEqual({ x: "Gym", w: "Work" });
    expect(await a.run()).toEqual({ done: "pulled" });
    expect(view(a)).toEqual(view(c));
  });

  test("a deleted group goes from every device", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["Gym", "Work"], channelGroups: { x: "Gym", y: "Work" } });
    await a.run();
    await b.run();
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: { x: "Gym", y: "Ungrouped" } });
    await a.run();
    await b.run();
    expect(view(b).groupNames).toEqual(["Ungrouped", "Gym"]);
  });

  test("only a complete write is applied: a header without all its items is left alone", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    const b = makeDevice(remote, "B");
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: { x: "Gym" } });
    await a.run();
    delete remote.data[chunkKey("999", 0)]; // the chunk has not arrived yet
    Object.assign(b.local, { groupNames: ["Mine"] });
    expect(await b.run()).toEqual({ done: "waiting_for_other_items" });
    expect(view(b).groupNames).toEqual(["Ungrouped", "Mine"]);
  });

  test("nothing is synced when the user switched syncing off, or no account is connected", async () => {
    const remote = makeRemote();
    let user: string | undefined;
    const a = makeDevice(remote, "A", { userId: () => user });
    Object.assign(a.local, { groupNames: ["Gym"] });
    expect(await a.run()).toEqual({ done: "no_account" });
    user = "999";
    a.setEnabled(false);
    expect(await a.run()).toEqual({ done: "off" });
    expect(remote.stats.sets).toBe(0);
  });

  test("logging out while a sync runs writes nothing", async () => {
    const remote = makeRemote();
    let calls = 0;
    const a = makeDevice(remote, "A", { userId: () => (++calls <= 1 ? "999" : undefined) });
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: { x: "Gym" } });
    await a.run();
    expect(remote.stats.sets).toBe(0);
    expect(a.base()).toBeNull();
  });

  test("groups too big for the quota are not pushed", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    Object.assign(a.local, {
      groupNames: ["Gym"],
      channelGroups: Object.fromEntries(Array.from({ length: 12_000 }, (_, i) => [`a_channel_name_${i}`, "Gym"])),
    });
    expect(await a.run()).toEqual({ done: "too_big" });
    expect(remote.stats.sets).toBe(0);
  });

  test("each account has its own synced groups", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A", { userId: () => "111" });
    const b = makeDevice(remote, "B", { userId: () => "222" });
    Object.assign(a.local, { groupNames: ["Gym"] });
    await a.run();
    expect(await b.run()).toEqual({ done: "nothing_to_share" });
    expect(view(b).groupNames).toEqual(["Ungrouped"]);
  });

  test("shrinking the groups removes the chunks that are no longer needed", async () => {
    const remote = makeRemote();
    const a = makeDevice(remote, "A");
    Object.assign(a.local, { groupNames: ["Gym"], channelGroups: Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`some_channel_${i}`, "Gym"])) });
    await a.run();
    const chunks = () => Object.keys(remote.data).filter((k) => /:m\d+$/.test(k)).length;
    const before = chunks();
    expect(before).toBeGreaterThan(1);
    a.local.channelGroups = { some_channel_1: "Gym" };
    await a.run();
    expect(chunks()).toBe(1);
  });
});
