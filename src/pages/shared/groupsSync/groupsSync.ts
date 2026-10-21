// Keeps the groups in step across a user's devices, through chrome.storage.sync. Storage, the clock and
// the hash are injected, so the rules are tested in plain node with several simulated devices.
//
// Local storage stays the source of truth for the sidebar and the dialog; this mirrors it. Each device
// remembers the state it last synced (its base) and compares three hashes: local, remote and base.
//   local = base, remote differs   someone else changed it: take the remote state
//   remote = base, local differs   this device changed it: push it
//   both differ                    both changed it: merge channel by channel (threeWayMerge), apply, push
// A device that has never synced has no base, so the first sync keeps both sides (unionMerge).
import {
  canonicalize,
  hashState,
  isEmptyState,
  threeWayMerge,
  unionMerge,
  type GroupsState,
  type RawGroups,
} from "./groupsState";
import { chunkKey, dataKeys, decodeState, encodeState, FORMAT_VERSION, MAX_TOTAL_BYTES, metaKey, type Meta } from "./remoteFormat";

export type SyncBase = { userId: string; rev: number; hash: string; state: GroupsState };

export type RemoteStore = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
};

export type SyncDeps = {
  remote: RemoteStore;
  // The connected Twitch account, or undefined when nobody is (nothing is synced then)
  userId: () => Promise<string | undefined>;
  // False when the user switched syncing off
  enabled: () => Promise<boolean>;
  readLocal: () => Promise<RawGroups>;
  writeLocal: (state: GroupsState) => Promise<void>;
  readBase: () => Promise<SyncBase | null>;
  writeBase: (base: SyncBase) => Promise<void>;
  deviceId: () => Promise<string>;
  hash?: (state: GroupsState) => Promise<string>;
  log?: (message: string, detail?: unknown) => void;
};

export type SyncResult =
  | { done: "off" | "no_account" | "nothing_to_share" | "in_step" | "pulled" | "pushed" | "merged" | "first_sync" }
  | { done: "waiting_for_other_items" | "gave_up" | "too_big" };

type Remote = { kind: "none" } | { kind: "torn" } | { kind: "ok"; rev: number; hash: string; state: GroupsState };

const ATTEMPTS = 4;

export const createGroupsSync = (deps: SyncDeps) => {
  const hash = deps.hash ?? hashState;

  const readRemote = async (userId: string): Promise<Remote> => {
    const meta = (await deps.remote.get([metaKey(userId)]))[metaKey(userId)] as Meta | undefined;
    if (!meta || meta.v !== FORMAT_VERSION) return { kind: "none" };
    const items = await deps.remote.get(dataKeys(userId, meta));
    const state = decodeState(userId, meta, items);
    // Items arrive one by one: only a set that hashes to the header's hash is a state somebody wrote
    if (!state || (await hash(state)) !== meta.hash) return { kind: "torn" };
    return { kind: "ok", rev: meta.rev, hash: meta.hash, state };
  };

  // Writes a state if the remote is still as it was when read (pull before push); false when it moved on
  const push = async (userId: string, state: GroupsState, stateHash: string, previousRev: number, readRev: number): Promise<"pushed" | "moved" | "too_big"> => {
    const current = (await deps.remote.get([metaKey(userId)]))[metaKey(userId)] as Meta | undefined;
    if ((current?.rev ?? 0) !== readRev) return "moved";

    const encoded = encodeState(userId, state, Math.max(previousRev, readRev) + 1, await deps.deviceId(), stateHash);
    if (encoded.bytes > MAX_TOTAL_BYTES) {
      deps.log?.(`groups are too big to sync (${encoded.bytes} bytes)`);
      return "too_big";
    }
    if ((await deps.userId()) !== userId) return "moved"; // logged out while we worked: write nothing

    await deps.remote.set(encoded.items); // the data first, the header after, so a reader trusts only a finished write
    await deps.remote.set({ [metaKey(userId)]: encoded.meta });
    const stale = current ? Array.from({ length: Math.max(0, current.chunks - encoded.meta.chunks) }, (_, i) => chunkKey(userId, encoded.meta.chunks + i)) : [];
    if (stale.length > 0) await deps.remote.remove(stale);
    return "pushed";
  };

  const run = async (): Promise<SyncResult> => {
    if (!(await deps.enabled())) return { done: "off" };
    const userId = await deps.userId();
    if (!userId) return { done: "no_account" };

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const localRaw = await deps.readLocal();
      const local = canonicalize(localRaw);
      const localHash = await hash(local);

      const remote = await readRemote(userId);
      if (remote.kind === "torn") return { done: "waiting_for_other_items" };
      const remoteRev = remote.kind === "ok" ? remote.rev : 0;

      const storedBase = await deps.readBase();
      const base = storedBase && storedBase.userId === userId ? storedBase : null;

      // The state to end up with, and what has to happen to get there
      let target: GroupsState;
      let targetHash: string;
      let result: SyncResult["done"];
      if (remote.kind === "none") {
        if (isEmptyState(local)) return { done: "nothing_to_share" };
        target = local;
        targetHash = localHash;
        result = "pushed";
      } else if (!base) {
        target = unionMerge(localRaw, remote.state);
        targetHash = await hash(target);
        result = "first_sync";
      } else if (localHash === remote.hash) {
        if (base.hash !== localHash || base.rev !== remote.rev) await deps.writeBase({ userId, rev: remote.rev, hash: localHash, state: local });
        return { done: "in_step" };
      } else if (localHash === base.hash) {
        target = remote.state;
        targetHash = remote.hash;
        result = "pulled";
      } else if (remote.hash === base.hash) {
        target = local;
        targetHash = localHash;
        result = "pushed";
      } else {
        target = threeWayMerge(base.state, local, remote.state);
        targetHash = await hash(target);
        result = "merged";
      }

      // Take the target into local storage, unless the user changed groups while we were working
      if (targetHash !== localHash) {
        const reread = await deps.readLocal();
        if ((await hash(canonicalize(reread))) !== localHash) continue;
        if ((await deps.userId()) !== userId) return { done: "no_account" };
        await deps.writeLocal(target);
      }

      let rev = remoteRev;
      if (remote.kind === "none" || targetHash !== remote.hash) {
        const pushed = await push(userId, target, targetHash, base?.rev ?? 0, remoteRev);
        if (pushed === "moved") continue;
        if (pushed === "too_big") return { done: "too_big" };
        rev = Math.max(base?.rev ?? 0, remoteRev) + 1;
      }
      if ((await deps.userId()) !== userId) return { done: "no_account" };
      await deps.writeBase({ userId, rev, hash: targetHash, state: target });
      return { done: result };
    }
    return { done: "gave_up" };
  };

  // One run at a time, so a burst of changes cannot interleave reads and writes
  let queue: Promise<unknown> = Promise.resolve();
  return {
    run: (): Promise<SyncResult> => {
      const next = queue.then(run, run) as Promise<SyncResult>;
      queue = next.catch((error) => deps.log?.("groups sync failed", error));
      return next;
    },
  };
};
