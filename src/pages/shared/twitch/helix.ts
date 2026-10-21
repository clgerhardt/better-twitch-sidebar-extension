// Twitch Helix client for the background service worker. Everything it needs from the environment
// (fetch, clock, sleep) is injected, so it can be tested in plain node with a fake clock.
//
// Requests are sequential and spaced out, never parallel. Twitch reports an 800/minute bucket for
// user tokens and neither this pacing nor parallel bursts were rejected when measured, but rapid
// calls were rejected in the past for reasons nobody recorded, so keep the pacing and log every 429.

const HELIX = "https://api.twitch.tv/helix";
const PAGE_SIZE = 100;

export type HelixErrorKind = "unauthorized" | "rate_limited" | "http" | "network";

export class HelixError extends Error {
  kind: HelixErrorKind;
  status?: number;
  constructor(kind: HelixErrorKind, message: string, status?: number) {
    super(message);
    this.name = "HelixError";
    this.kind = kind;
    this.status = status;
  }
}

export type HelixDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  clientId: string;
  log?: (message: string, detail?: unknown) => void;
  // Minimum gap between the start of two requests
  spacingMs?: number;
  // How many times a 429 is retried before giving up
  maxRetries?: number;
  // Longest we will wait for a 429 to clear
  maxWaitMs?: number;
};

export type FollowedChannel = { id: string; login: string; displayName: string };
export type TwitchUser = { id: string; login: string; displayName: string; image: string };
export type LiveStream = { id: string; login: string; displayName: string; game: string; title: string; viewers: number };

export const createHelixClient = (deps: HelixDeps) => {
  const spacingMs = deps.spacingMs ?? 100;
  const maxRetries = deps.maxRetries ?? 3;
  const maxWaitMs = deps.maxWaitMs ?? 60_000;
  let lastStart: number | null = null;

  const pace = async () => {
    if (lastStart !== null) {
      const wait = spacingMs - (deps.now() - lastStart);
      if (wait > 0) await deps.sleep(wait);
    }
    lastStart = deps.now();
  };

  // How long to wait after a 429: until Ratelimit-Reset (a Unix time in seconds) when Twitch sends
  // it, otherwise 1s, 2s, 3s... Never longer than maxWaitMs.
  const backoffMs = (reset: string | null, attempt: number) => {
    const resetSeconds = reset ? Number(reset) : NaN;
    const wait = Number.isFinite(resetSeconds) ? Math.max(0, resetSeconds * 1000 - deps.now()) : attempt * 1000;
    return Math.min(wait, maxWaitMs);
  };

  const get = async (path: string, params: [string, string][], token: string): Promise<any> => {
    const url = `${HELIX}/${path}?${new URLSearchParams(params).toString()}`;
    for (let attempt = 1; ; attempt++) {
      await pace();

      let response: Response;
      try {
        response = await deps.fetch(url, { headers: { Authorization: `Bearer ${token}`, "Client-Id": deps.clientId } });
      } catch (error) {
        throw new HelixError("network", `Request to ${path} failed: ${String(error)}`);
      }

      if (response.status === 401) throw new HelixError("unauthorized", `Unauthorized: ${path}`, 401);

      if (response.status === 429) {
        deps.log?.(`429 from ${path} (attempt ${attempt}, remaining ${response.headers.get("ratelimit-remaining")})`);
        if (attempt > maxRetries) throw new HelixError("rate_limited", `Rate limited: ${path}`, 429);
        await deps.sleep(backoffMs(response.headers.get("ratelimit-reset"), attempt));
        continue;
      }

      if (!response.ok) throw new HelixError("http", `HTTP ${response.status}: ${path}`, response.status);
      return response.json();
    }
  };

  // Walks every page of a cursor-paginated endpoint
  const getAllPages = async (path: string, params: [string, string][], token: string): Promise<any[]> => {
    const items: any[] = [];
    let cursor: string | undefined;
    do {
      const query: [string, string][] = [...params, ["first", String(PAGE_SIZE)]];
      if (cursor) query.push(["after", cursor]);
      const page = await get(path, query, token);
      items.push(...(page.data ?? []));
      cursor = page.pagination?.cursor || undefined;
    } while (cursor);
    return items;
  };

  return {
    // Everyone the user follows: id, login and display name. total is Twitch's own count.
    getFollowedChannels: async (token: string, userId: string): Promise<{ total: number; channels: FollowedChannel[] }> => {
      const params: [string, string][] = [["user_id", userId]];
      const items: any[] = [];
      let total = 0;
      let cursor: string | undefined;
      do {
        const query: [string, string][] = [...params, ["first", String(PAGE_SIZE)]];
        if (cursor) query.push(["after", cursor]);
        const page = await get("channels/followed", query, token);
        total = page.total ?? total;
        items.push(...(page.data ?? []));
        cursor = page.pagination?.cursor || undefined;
      } while (cursor);
      return {
        total: total || items.length,
        channels: items.map((i) => ({ id: i.broadcaster_id, login: i.broadcaster_login, displayName: i.broadcaster_name })),
      };
    },

    // Profile data (mainly avatars), at most 100 ids per request
    getUsers: async (token: string, ids: string[]): Promise<TwitchUser[]> => {
      const users: TwitchUser[] = [];
      for (let i = 0; i < ids.length; i += PAGE_SIZE) {
        const data = await get("users", ids.slice(i, i + PAGE_SIZE).map((id) => ["id", id] as [string, string]), token);
        users.push(
          ...(data.data ?? []).map((u: any) => ({ id: u.id, login: u.login, displayName: u.display_name, image: u.profile_image_url ?? "" }))
        );
      }
      return users;
    },

    // One channel's profile by login, whether or not the user follows it (public data, so it works
    // before the follow list has caught up). null when there is no such channel.
    getUserByLogin: async (token: string, login: string): Promise<TwitchUser | null> => {
      const data = await get("users", [["login", login]], token);
      const u = data.data?.[0];
      return u ? { id: u.id, login: u.login, displayName: u.display_name, image: u.profile_image_url ?? "" } : null;
    },

    // Which of these channels (by id, at most 100) are live right now, followed or not
    getStreams: async (token: string, ids: string[]): Promise<LiveStream[]> => {
      if (ids.length === 0) return [];
      const data = await get("streams", ids.slice(0, PAGE_SIZE).map((id) => ["user_id", id] as [string, string]), token);
      return (data.data ?? []).map((s: any) => ({
        id: s.user_id,
        login: s.user_login,
        displayName: s.user_name,
        game: s.game_name ?? "",
        title: s.title ?? "",
        viewers: s.viewer_count ?? 0,
      }));
    },

    // The followed channels that are live right now, in one paginated call
    getLiveFollowed: async (token: string, userId: string): Promise<LiveStream[]> => {
      const items = await getAllPages("streams/followed", [["user_id", userId]], token);
      return items.map((s) => ({
        id: s.user_id,
        login: s.user_login,
        displayName: s.user_name,
        game: s.game_name ?? "",
        title: s.title ?? "",
        viewers: s.viewer_count ?? 0,
      }));
    },
  };
};

export type HelixClient = ReturnType<typeof createHelixClient>;
