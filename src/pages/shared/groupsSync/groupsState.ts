// The user's groups as one value that can be compared, hashed and merged. Pure functions only (no chrome.*
// or Vite imports), so the sync rules are tested in plain node.
import { normalizeGroupColor } from "../../utils/groupColor";

export const UNGROUPED = "Ungrouped";

// What is stored locally, as the sidebar and the dialog read and write it. Every part may be missing.
export type RawGroups = {
  groupNames?: string[];
  defaultGroup?: string;
  groupColors?: Record<string, string>;
  channelGroups?: Record<string, string>;
};

// The canonical form: the same groups always give the same value, whatever order things were stored in
//   - groupNames is the order of every group, the default group and any group a channel uses included
//   - channelGroups has only the channels that are NOT in the default group (those are implied)
//   - colors are valid "#rrggbb" values of groups that exist
export type GroupsState = {
  groupNames: string[];
  defaultGroup: string;
  groupColors: Record<string, string>;
  channelGroups: Record<string, string>;
};

const sorted = <T>(entries: [string, T][]): [string, T][] => entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export const canonicalize = (raw: RawGroups): GroupsState => {
  const defaultGroup = raw.defaultGroup || UNGROUPED;
  const saved = (raw.groupNames ?? []).filter((n, i, all) => typeof n === "string" && n !== "" && all.indexOf(n) === i);

  const channelGroups: Record<string, string> = {};
  for (const [login, group] of sorted(Object.entries(raw.channelGroups ?? {}))) {
    if (group && group !== defaultGroup) channelGroups[login] = group;
  }

  // The default group is first when the order does not say otherwise; a group only a channel mentions still exists
  const groupNames = saved.includes(defaultGroup) ? saved : [defaultGroup, ...saved];
  for (const group of [...new Set(Object.values(channelGroups))].sort()) {
    if (!groupNames.includes(group)) groupNames.push(group);
  }

  const groupColors: Record<string, string> = {};
  for (const [name, value] of sorted(Object.entries(raw.groupColors ?? {}))) {
    const color = normalizeGroupColor(value);
    if (color && groupNames.includes(name)) groupColors[name] = color;
  }

  return { groupNames, defaultGroup, groupColors, channelGroups };
};

// Bumped if the canonical form ever changes, so old and new versions never think their states differ for no reason
const FORMAT = 1;

// The text a state is hashed as: fixed order, no dependence on object key order
export const serializeState = (state: GroupsState): string =>
  JSON.stringify({ v: FORMAT, n: state.groupNames, d: state.defaultGroup, c: sorted(Object.entries(state.groupColors)), m: sorted(Object.entries(state.channelGroups)) });

export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const hashState = (state: GroupsState): Promise<string> => sha256Hex(serializeState(state));

// A state with nothing in it worth sharing: no groups, colors or assignments, and the original default group
export const isEmptyState = (state: GroupsState): boolean =>
  state.defaultGroup === UNGROUPED &&
  state.groupNames.length === 1 &&
  Object.keys(state.groupColors).length === 0 &&
  Object.keys(state.channelGroups).length === 0;

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);

// Three-way rule for one value: the side that changed wins; if both changed, the remote one wins (so both
// devices end up with the same result)
const pick = <T>(base: T, local: T, remote: T, same: (a: T, b: T) => boolean = (a, b) => a === b): T => {
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  return remote;
};

const assignment = (state: GroupsState, login: string) => state.channelGroups[login] ?? state.defaultGroup;

// Merges two edited copies of the same starting point (base), channel by channel: only a channel (or group
// or color) changed differently on both sides is a conflict, and there the remote value wins.
export const threeWayMerge = (base: GroupsState, local: GroupsState, remote: GroupsState): GroupsState => {
  const defaultGroup = pick(base.defaultGroup, local.defaultGroup, remote.defaultGroup);

  const channelGroups: Record<string, string> = {};
  const logins = new Set([...Object.keys(base.channelGroups), ...Object.keys(local.channelGroups), ...Object.keys(remote.channelGroups)]);
  for (const login of [...logins].sort()) {
    const group = pick(assignment(base, login), assignment(local, login), assignment(remote, login));
    if (group !== defaultGroup) channelGroups[login] = group;
  }

  let groupNames: string[];
  if (sameList(local.groupNames, base.groupNames)) groupNames = remote.groupNames;
  else if (sameList(remote.groupNames, base.groupNames)) groupNames = local.groupNames;
  else {
    // Both changed the list: the remote order, without what this side removed, plus what this side added
    const removedHere = base.groupNames.filter((n) => !local.groupNames.includes(n));
    groupNames = remote.groupNames.filter((n) => !removedHere.includes(n));
    for (const n of local.groupNames) if (!base.groupNames.includes(n) && !groupNames.includes(n)) groupNames.push(n);
  }

  const groupColors: Record<string, string> = {};
  const colored = new Set([...Object.keys(base.groupColors), ...Object.keys(local.groupColors), ...Object.keys(remote.groupColors)]);
  for (const name of colored) {
    const color = pick<string | undefined>(base.groupColors[name], local.groupColors[name], remote.groupColors[name]);
    if (color) groupColors[name] = color;
  }

  return canonicalize({ groupNames, defaultGroup, groupColors, channelGroups });
};

// The first time a device syncs, it has no common starting point. Nothing the user chose is lost: both
// sets of groups are kept (the remote order first), colors and assignments the remote has win, and a
// channel the remote only has in its default group stays where this device put it.
//
// A channel in this device's own default group is NOT a choice: a new device puts every channel in its
// default group as soon as it loads. Those follow the synced default group instead, and the device's own
// built-in "Ungrouped" is not carried over as a group.
export const unionMerge = (localRaw: RawGroups, remote: GroupsState): GroupsState => {
  const defaultGroup = remote.defaultGroup;
  // Only assignments to groups other than this device's default (canonicalize drops the rest)
  const chosen = canonicalize(localRaw);

  const groupNames = [...remote.groupNames];
  for (const n of localRaw.groupNames ?? []) if (n && !groupNames.includes(n)) groupNames.push(n);

  return canonicalize({
    groupNames,
    defaultGroup,
    groupColors: { ...(localRaw.groupColors ?? {}), ...remote.groupColors },
    channelGroups: { ...chosen.channelGroups, ...remote.channelGroups },
  });
};
