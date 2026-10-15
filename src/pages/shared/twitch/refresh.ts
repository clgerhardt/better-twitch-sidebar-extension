// Refreshes the stored channel snapshot from Twitch. Storage, the Helix client and the clock are
// injected, so the rules below are tested in plain node.
//
// Rules that matter for privacy: a snapshot belongs to one Twitch user and is never reused for
// another; a refresh that is still running when the user logs out (or another account connects)
// writes nothing.
import { CHANNEL_SNAPSHOT_KEY, SNAPSHOT_ERROR_KEY } from "../../utils/constants";
import { HelixError, type HelixClient } from "./helix";
import { applyLive, avatarsFrom, buildSnapshot, idsNeedingAvatars, isSnapshotFor } from "./snapshot";

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

export const createRefresher = (deps: Deps) => {
  const { client, storage, now, log } = deps;
  let inFlight: Promise<RefreshResult> | null = null;

  const readSession = async () => {
    const stored = await storage.get(["twitchToken", "twitchUserId"]);
    return { token: stored.twitchToken as string | undefined, userId: stored.twitchUserId as string | undefined };
  };

  const run = async (force: boolean, renewed = false): Promise<RefreshResult> => {
    const stored = await storage.get(["twitchToken", "twitchUserId", CHANNEL_SNAPSHOT_KEY]);
    const token: string | undefined = stored.twitchToken;
    const userId: string | undefined = stored.twitchUserId;
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
      if (!existing || now() - existing.staticAt >= STATIC_MAX_AGE_MS) {
        const { channels: follows } = await client.getFollowedChannels(token, userId);
        const avatars = avatarsFrom(existing, userId);
        const missing = idsNeedingAvatars(follows, avatars);
        for (const user of await client.getUsers(token, missing)) {
          if (user.image) avatars[user.id] = user.image;
        }
        const live = await client.getLiveFollowed(token, userId);
        const at = now();
        snapshot = buildSnapshot({ userId, follows, avatars, live, fetchedAt: at, staticAt: at });
      } else {
        const live = await client.getLiveFollowed(token, userId);
        snapshot = applyLive(existing, live, now());
      }

      if (!(await sameSession())) return { ok: false, reason: "discarded" };
      await storage.set({ [CHANNEL_SNAPSHOT_KEY]: snapshot });
      await storage.remove([SNAPSHOT_ERROR_KEY]);
      return { ok: true };
    } catch (error) {
      if (!(await sameSession())) return { ok: false, reason: "discarded" };
      // A rejected token gets one quiet renewal and one retry, never a loop
      if (error instanceof HelixError && error.kind === "unauthorized" && deps.renewToken && !renewed) {
        log?.("token rejected, renewing");
        if (await deps.renewToken()) return run(true, true);
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
    // Callers that arrive while a refresh is running share its result, unless that refresh was for a
    // session that has since ended (logout, another account): its result is thrown away, so a caller
    // that only joined it starts a fresh refresh for the session that is connected now
    refresh: async (force = false): Promise<RefreshResult> => {
      for (let attempt = 0; ; attempt++) {
        const joined = inFlight !== null;
        if (!inFlight) {
          inFlight = run(force).finally(() => {
            inFlight = null;
          });
        }
        const result = await inFlight;
        const discarded = !result.ok && result.reason === "discarded";
        if (!discarded || !joined || attempt >= 2) return result;
      }
    },
  };
};
