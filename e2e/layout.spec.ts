import { test, expect } from "@playwright/test";
import { layoutGroups, type FetchedChannel } from "../src/pages/utils/layoutGroups";

const ch = (login: string, isLive = false, viewers = isLive ? 1 : 0): FetchedChannel => ({
  login,
  channel: {
    login,
    channelName: login.toUpperCase(),
    channelLink: `https://twitch.tv/${login}`,
    channelImage: "",
    isLive,
    viewers,
    viewerCount: isLive ? `${viewers} viewers` : undefined,
  },
});

const names = (result: ReturnType<typeof layoutGroups>) => result.groups.map((g) => g.groupName);
const logins = (result: ReturnType<typeof layoutGroups>, group: string) =>
  result.groups.find((g) => g.groupName === group)!.followedChannels.map((c) => c.login);

test.describe("layoutGroups", () => {
  test("with no channels there is still an empty Ungrouped group", () => {
    const result = layoutGroups({ fetched: [], groupNames: [], channelGroups: {} });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ groupName: "Ungrouped", default: true, numberOfChannels: 0, numberOfLiveChannels: 0, order: 0 });
    expect(result.addedMappings).toBe(false);
  });

  test("channels with no group go to Ungrouped and are reported as new mappings", () => {
    const result = layoutGroups({ fetched: [ch("a"), ch("b")], groupNames: [], channelGroups: {} });
    expect(logins(result, "Ungrouped")).toEqual(["a", "b"]);
    expect(result.channelGroups).toEqual({ a: "Ungrouped", b: "Ungrouped" });
    expect(result.addedMappings).toBe(true);
  });

  test("mapped channels go to their group and nothing is reported as new", () => {
    const result = layoutGroups({
      fetched: [ch("a"), ch("b"), ch("c")],
      groupNames: ["Squad"],
      channelGroups: { a: "Squad", b: "Ungrouped", c: "Squad" },
    });
    expect(logins(result, "Squad")).toEqual(["a", "c"]);
    expect(logins(result, "Ungrouped")).toEqual(["b"]);
    expect(result.addedMappings).toBe(false);
  });

  test("an empty mapping counts as unmapped", () => {
    const result = layoutGroups({ fetched: [ch("a")], groupNames: [], channelGroups: { a: "" } });
    expect(logins(result, "Ungrouped")).toEqual(["a"]);
    expect(result.channelGroups.a).toBe("Ungrouped");
    expect(result.addedMappings).toBe(true);
  });

  test("Ungrouped comes first, then groups in their saved order, including empty ones", () => {
    const result = layoutGroups({ fetched: [ch("a")], groupNames: ["Zebra", "Alpha", "Empty"], channelGroups: { a: "Alpha" } });
    expect(names(result)).toEqual(["Ungrouped", "Zebra", "Alpha", "Empty"]);
    expect(result.groups.map((g) => g.order)).toEqual([0, 1, 2, 3]);
    expect(result.groups.find((g) => g.groupName === "Empty")!.numberOfChannels).toBe(0);
  });

  test("a group that exists only in the channel map is still shown, after the saved groups", () => {
    const result = layoutGroups({
      fetched: [ch("a"), ch("b"), ch("c")],
      groupNames: ["Saved"],
      channelGroups: { a: "Orphan2", b: "Orphan1", c: "Saved" },
    });
    // orphans appear in the order their first channel was seen
    expect(names(result)).toEqual(["Ungrouped", "Saved", "Orphan2", "Orphan1"]);
  });

  test("channels without a group land in the chosen default group, which keeps its saved place", () => {
    const result = layoutGroups({ fetched: [ch("a"), ch("b")], groupNames: ["A", "Inbox", "B"], channelGroups: { a: "A" }, defaultGroup: "Inbox" });
    expect(names(result)).toEqual(["A", "Inbox", "B"]);
    expect(result.groups.filter((g) => g.default).map((g) => g.groupName)).toEqual(["Inbox"]);
    expect(result.channelGroups).toEqual({ a: "A", b: "Inbox" });
    expect(result.addedMappings).toBe(true);
  });

  test("a default group missing from the saved order is shown first", () => {
    const result = layoutGroups({ fetched: [], groupNames: ["A"], channelGroups: {}, defaultGroup: "Inbox" });
    expect(names(result)).toEqual(["Inbox", "A"]);
  });

  test("only Ungrouped is the default group", () => {
    const result = layoutGroups({ fetched: [], groupNames: ["A", "B"], channelGroups: {} });
    expect(result.groups.filter((g) => g.default).map((g) => g.groupName)).toEqual(["Ungrouped"]);
    expect(result.groups.every((g) => g.dialogOpen === false && g.dropdownVisible === false)).toBe(true);
  });

  test("live channels come first, most viewers first; offline ones follow in their original order", () => {
    const result = layoutGroups({
      fetched: [ch("off1"), ch("small", true, 20), ch("off2"), ch("big", true, 5000), ch("mid", true, 300)],
      groupNames: [],
      channelGroups: {},
    });
    expect(logins(result, "Ungrouped")).toEqual(["big", "mid", "small", "off1", "off2"]);
  });

  test("live channels with the same viewer count keep their original order", () => {
    const result = layoutGroups({
      fetched: [ch("a", true, 10), ch("b", true, 99), ch("c", true, 10), ch("d", true, 99)],
      groupNames: [],
      channelGroups: {},
    });
    expect(logins(result, "Ungrouped")).toEqual(["b", "d", "a", "c"]);
  });

  test("each group is sorted on its own", () => {
    const result = layoutGroups({
      fetched: [ch("a", true, 5), ch("b", true, 50), ch("c", true, 7), ch("d", true, 70)],
      groupNames: ["G"],
      channelGroups: { a: "G", b: "G", c: "Ungrouped", d: "Ungrouped" },
    });
    expect(logins(result, "G")).toEqual(["b", "a"]);
    expect(logins(result, "Ungrouped")).toEqual(["d", "c"]);
  });

  test("counts include live channels", () => {
    const result = layoutGroups({ fetched: [ch("a", true), ch("b"), ch("c", true)], groupNames: [], channelGroups: {} });
    expect(result.groups[0]).toMatchObject({ numberOfChannels: 3, numberOfLiveChannels: 2 });
  });

  test("a duplicated saved name does not create duplicate groups, and a saved 'Ungrouped' keeps its place", () => {
    const result = layoutGroups({ fetched: [], groupNames: ["A", "Ungrouped", "A", "B"], channelGroups: {} });
    expect(names(result)).toEqual(["A", "Ungrouped", "B"]);
  });

  test("does not modify its inputs", () => {
    const fetched = Object.freeze([ch("a"), ch("b", true)]) as unknown as FetchedChannel[];
    const groupNames = Object.freeze(["G"]) as unknown as string[];
    const channelGroups = Object.freeze({ a: "G" }) as Record<string, string>;
    expect(() => layoutGroups({ fetched, groupNames, channelGroups })).not.toThrow();
    expect(channelGroups).toEqual({ a: "G" });
  });
});
