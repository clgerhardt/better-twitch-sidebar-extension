// Refreshes the stored channel snapshot from Twitch. Storage, the Helix client and the clock are
// injected, so the rules below are tested in plain node.
//
// Rules that matter for privacy: a snapshot belongs to one Twitch user and is never reused for
// another; a refresh that is still running when the user logs out (or another account connects)
// writes nothing.
import { CHANNEL_SNAPSHOT_KEY, PENDING_FOLLOWS_KEY, SNAPSHOT_ERROR_KEY } from "../../utils/constants";
import { HelixError, type HelixClient } from "./helix";
import { applyLive, avatarsFrom, buildSnapshot, idsNeedingAvatars, isSnapshotFor, prunePending } from "./snapshot";

// A snapshot younger than this is not refreshed again (several tabs load at once) unless forced
export const MIN_REFRESH_AGE_MS = 10_000;
// The follow list and avatars change slowly; live status is refreshed on every refresh
export const STATIC_MAX_AGE_MS = 10 * 60_000;

export type RefreshStorage = {
  get: (keys: string[]) => Promise<Record<string, any>>;
  set: (items: Record<string, any>) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
};

export type RefreshFailure = "not_connected" | "unauthorized" | "rate_limited" | "failed" | "discarded" | "paused";
export type RefreshResult = { ok: true; skipped?: boolean } | { ok: false; reason: RefreshFailure };

type Deps = {
  client: Pick<HelixClient, "getFollowedChannels" | "getUsers" | "getLiveFollowed">;
  storage: RefreshStorage;
  now: () => number;
  // True while refreshing must not happen (the browser is signed out of Twitch): nothing is fetched or recorded
  isPaused?: () => Promise<boolean>;
  // Gets a new token for the same account after Twitch rejected the stored one, writes it to
  // storage and returns it; null when that is not possible (the user must reconnect)
  renewToken?: () => Promise<string | null>;
  log?: (message: string, detail?: unknown) => void;
};

type Flight = { promise: Promise<RefreshResult>; session?: string; refreshFollows: boolean };

export const createRefresher = (deps: Deps) => {
  const { client, storage, now, log } = deps;
  // The refresh that is running, and the session (token and account) it read when it started
  let inFlight: Flight | null = null;

  const readSession = async () => {
    const stored = await storage.get(["twitchToken", "twitchUserId"]);
    return { token: stored.twitchToken as string | undefined, userId: stored.twitchUserId as string | undefined };
  };
  const sessionKey = (session: { token?: string; userId?: string }) => `${session.token ?? ""}|${session.userId ?? ""}`;

  // The account's own profile picture is saved when it connects, but older sessions never saved one. Fetch
  // it once if it is missing so the popup can show it; this must never fail or delay a refresh.
  const ensureProfileImage = async (token: string, userId: string, sameSession: () => Promise<boolean>) => {
    try {
      const { twitchUserImage } = await storage.get(["twitchUserImage"]);
      if (twitchUserImage) return;
      const [me] = await client.getUsers(token, [userId]);
      if (me?.image && (await sameSession())) await storage.set({ twitchUserImage: me.image });
    } catch (error) {
      log?.("could not load the profile picture", error);
    }
  };

  const run = async (flight: Flight, force: boolean, refreshFollows: boolean, renewed = false): Promise<RefreshResult> => {
    const stored = await storage.get(["twitchToken", "twitchUserId", CHANNEL_SNAPSHOT_KEY]);
    const token: string | undefined = stored.twitchToken;
    const userId: string | undefined = stored.twitchUserId;
    flight.session = sessionKey({ token, userId });
    if (!token || !userId) return { ok: false, reason: "not_connected" };
    if (await deps.isPaused?.()) return { ok: false, reason: "paused" };

    const existing = isSnapshotFor(stored[CHANNEL_SNAPSHOT_KEY], userId) ? stored[CHANNEL_SNAPSHOT_KEY] : undefined;
    if (existing && !force && now() - existing.fetchedAt < MIN_REFRESH_AGE_MS) return { ok: true, skipped: true };

    // Is this still the account we started for? If not, nothing may be written.
    const sameSession = async () => {
      const current = await readSession();
      return current.token === token && current.userId === userId;
    };

    try {
      let snapshot;
      if (!existing || refreshFollows || now() - existing.staticAt >= STATIC_MAX_AGE_MS) {
        const { channels: follows } = await client.getFollowedChannels(token, userId);
        const avatars = avatarsFrom(existing, userId);
        const missing = idsNeedingAvatars(follows, avatars);
        for (const user of await client.getUsers(token, missing)) {
          if (user.image) avatars[user.id] = user.image;
        }
        const live = await client.getLiveFollowed(token, userId);
        const at = now();
        snapshot = buildSnapshot({ userId, follows, avatars, live, fetchedAt: at, staticAt: at });
        // Channels the list now includes (or that waited too long) are no longer pending
        const stored = await storage.get([PENDING_FOLLOWS_KEY]);
        if (stored[PENDING_FOLLOWS_KEY]) {
          const kept = prunePending(stored[PENDING_FOLLOWS_KEY], userId, follows, at);
          if (kept) await storage.set({ [PENDING_FOLLOWS_KEY]: kept });
          else await storage.remove([PENDING_FOLLOWS_KEY]);
        }
      } else {
        const live = await client.getLiveFollowed(token, userId);
        snapshot = applyLive(existing, live, now());
      }

      if (!(await sameSession())) return { ok: false, reason: "discarded" };
      await storage.set({ [CHANNEL_SNAPSHOT_KEY]: snapshot });
      await storage.remove([SNAPSHOT_ERROR_KEY]);
      await ensureProfileImage(token, userId, sameSession);
      return { ok: true };
    } catch (error) {
      if (!(await sameSession())) return { ok: false, reason: "discarded" };
      // A rejected token gets one quiet renewal and one retry, never a loop
      if (error instanceof HelixError && error.kind === "unauthorized" && deps.renewToken && !renewed) {
        log?.("token rejected, renewing");
        if (await deps.renewToken()) return run(flight, true, refreshFollows, true);
        if (!(await sameSession())) return { ok: false, reason: "discarded" };
      }
      const reason: RefreshFailure =
        error instanceof HelixError ? (error.kind === "unauthorized" ? "unauthorized" : error.kind === "rate_limited" ? "rate_limited" : "failed") : "failed";
      log?.(`refresh failed: ${reason}`, error);
      await storage.set({ [SNAPSHOT_ERROR_KEY]: reason });
      return { ok: false, reason };
    }
  };

  return {
    // Callers that arrive while a refresh is running share its result, unless that refresh ran for a
    // session that is not the connected one now (logout, another account, or it started before anyone
    // was connected): its result says nothing about the session this caller is asking for, so the
    // caller that only joined it starts a fresh refresh
    // refreshFollows fetches the follow list now instead of when the stored one is old (a follow just happened)
    refresh: async (force = false, refreshFollows = false): Promise<RefreshResult> => {
      for (let attempt = 0; ; attempt++) {
        // A refresh already running without the follow list is no use to this caller: let it finish, then ask again
        if (attempt < 3 && inFlight && refreshFollows && !inFlight.refreshFollows) {
          await inFlight.promise;
          continue;
        }
        const joined = inFlight !== null;
        let flight = inFlight;
        if (!flight) {
          const started: Flight = { promise: undefined as unknown as Promise<RefreshResult>, refreshFollows };
          started.promise = run(started, force, refreshFollows).finally(() => {
            if (inFlight === started) inFlight = null;
          });
          flight = inFlight = started;
        }
        const result = await flight.promise;
        if (!joined || attempt >= 2) return result;
        const discarded = !result.ok && result.reason === "discarded";
        if (!discarded && flight.session === sessionKey(await readSession())) return result;
      }
    },
  };
};
