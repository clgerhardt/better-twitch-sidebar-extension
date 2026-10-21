// How the groups are laid out in chrome.storage.sync. Pure functions only, so it is tested in plain node.
//
// chrome.storage.sync allows 8,192 bytes per item (key length plus the JSON of the value), about 100 KB in
// all, and each item is written on its own, so a reader can see some items new and others old. The state
// is therefore split into:
//   meta  { v, rev, hash, chunks, device }   written last; hash is the hash of the state the other items hold
//   core  { n, d, c }                        group order, default group, colors
//   m0..  { login: index into n }            the channels that are not in the default group
// A reader assembles the items and uses them only when they hash to meta.hash.
import { canonicalize, serializeState, type GroupsState } from "./groupsState";

export const SYNC_PREFIX = "bsg:";
export const FORMAT_VERSION = 1;

// Under the 8,192-byte item limit, leaving room for the key and quoting
export const MAX_ITEM_BYTES = 7_500;
// Under the 102,400-byte total
export const MAX_TOTAL_BYTES = 90_000;

export type Meta = { v: number; rev: number; hash: string; chunks: number; device: string };

export const metaKey = (userId: string) => `${SYNC_PREFIX}${userId}:meta`;
export const coreKey = (userId: string) => `${SYNC_PREFIX}${userId}:core`;
export const chunkKey = (userId: string, index: number) => `${SYNC_PREFIX}${userId}:m${index}`;

// What chrome.storage.sync counts for an item
const itemBytes = (key: string, value: unknown) => new TextEncoder().encode(key + JSON.stringify(value)).length;

export type Encoded = { meta: Meta; items: Record<string, unknown>; bytes: number };

export const encodeState = (userId: string, state: GroupsState, rev: number, device: string, hash: string): Encoded => {
  const indexOf = new Map(state.groupNames.map((name, i) => [name, i]));
  const items: Record<string, unknown> = { [coreKey(userId)]: { n: state.groupNames, d: state.defaultGroup, c: state.groupColors } };

  let index = 0;
  let current: Record<string, number> = {};
  const flush = () => {
    if (Object.keys(current).length === 0) return;
    items[chunkKey(userId, index++)] = current;
    current = {};
  };
  for (const [login, group] of Object.entries(state.channelGroups)) {
    const next = { ...current, [login]: indexOf.get(group)! };
    if (Object.keys(current).length > 0 && itemBytes(chunkKey(userId, index), next) > MAX_ITEM_BYTES) {
      flush();
      current = { [login]: indexOf.get(group)! };
    } else current = next;
  }
  flush();

  const meta: Meta = { v: FORMAT_VERSION, rev, hash, chunks: index, device };
  const bytes = Object.entries({ ...items, [metaKey(userId)]: meta }).reduce((sum, [key, value]) => sum + itemBytes(key, value), 0);
  return { meta, items, bytes };
};

// The keys holding the data a header describes
export const dataKeys = (userId: string, meta: Meta): string[] => [coreKey(userId), ...Array.from({ length: meta.chunks }, (_, i) => chunkKey(userId, i))];

// The state the items hold, or null when an item is missing or malformed (a reader that sees only part of a write)
export const decodeState = (userId: string, meta: Meta, items: Record<string, unknown>): GroupsState | null => {
  const core = items[coreKey(userId)] as { n?: unknown; d?: unknown; c?: unknown } | undefined;
  if (!core || !Array.isArray(core.n) || typeof core.d !== "string") return null;
  const names = core.n as string[];

  const channelGroups: Record<string, string> = {};
  for (let i = 0; i < meta.chunks; i++) {
    const chunk = items[chunkKey(userId, i)] as Record<string, number> | undefined;
    if (!chunk || typeof chunk !== "object") return null;
    for (const [login, group] of Object.entries(chunk)) {
      if (typeof names[group] !== "string") return null;
      channelGroups[login] = names[group];
    }
  }
  return canonicalize({ groupNames: names, defaultGroup: core.d, groupColors: (core.c as Record<string, string>) ?? {}, channelGroups });
};

// Both ends serialise the same way, so the hash can be recomputed from a decoded state
export { serializeState };
