import { test, expect } from "@playwright/test";
import { createHelixClient, HelixError } from "../src/pages/shared/twitch/helix";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

// A fake clock and fetch: sleeping advances time, requests take no time
const setup = (handler: (url: URL, call: number) => Reply, options: { spacingMs?: number; maxRetries?: number; maxWaitMs?: number } = {}) => {
  let time = 1_000_000;
  const sleeps: number[] = [];
  const calls: { path: string; params: Record<string, string[]>; at: number; headers: Record<string, string> }[] = [];
  const logs: string[] = [];

  const fakeFetch = async (input: any, init?: any) => {
    const url = new URL(String(input));
    const params: Record<string, string[]> = {};
    url.searchParams.forEach((v, k) => (params[k] = [...(params[k] ?? []), v]));
    calls.push({ path: url.pathname.replace("/helix/", ""), params, at: time, headers: init?.headers ?? {} });
    const reply = handler(url, calls.length);
    return {
      ok: (reply.status ?? 200) >= 200 && (reply.status ?? 200) < 300,
      status: reply.status ?? 200,
      headers: { get: (name: string) => reply.headers?.[name.toLowerCase()] ?? null },
      json: async () => reply.body ?? {},
      text: async () => JSON.stringify(reply.body ?? {}),
    } as Response;
  };

  const client = createHelixClient({
    fetch: fakeFetch as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
    now: () => time,
    clientId: "client-1",
    log: (message) => logs.push(message),
    ...options,
  });
  return { client, calls, sleeps, logs, advance: (ms: number) => (time += ms), now: () => time };
};

test.describe("Helix client", () => {
  test("getFollowedChannels follows the cursor and sends auth headers", async () => {
    const { client, calls } = setup((url) => {
      const after = url.searchParams.get("after");
      return after
        ? { body: { total: 3, data: [{ broadcaster_id: "3", broadcaster_login: "c", broadcaster_name: "C" }], pagination: {} } }
        : { body: { total: 3, data: [{ broadcaster_id: "1", broadcaster_login: "a", broadcaster_name: "A" }, { broadcaster_id: "2", broadcaster_login: "b", broadcaster_name: "B" }], pagination: { cursor: "next" } } };
    });
    const result = await client.getFollowedChannels("tok", "999");
    expect(result.total).toBe(3);
    expect(result.channels).toEqual([
      { id: "1", login: "a", displayName: "A" },
      { id: "2", login: "b", displayName: "B" },
      { id: "3", login: "c", displayName: "C" },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].path).toBe("channels/followed");
    expect(calls[0].params).toMatchObject({ user_id: ["999"], first: ["100"] });
    expect(calls[1].params.after).toEqual(["next"]);
    expect(calls[0].headers).toMatchObject({ Authorization: "Bearer tok", "Client-Id": "client-1" });
  });

  test("getUsers asks for at most 100 ids per call and returns avatars", async () => {
    const ids = Array.from({ length: 230 }, (_, i) => String(i + 1));
    const { client, calls } = setup((url) => ({
      body: { data: url.searchParams.getAll("id").map((id) => ({ id, login: `l${id}`, display_name: `L${id}`, profile_image_url: `https://img/${id}.png` })) },
    }));
    const users = await client.getUsers("tok", ids);
    expect(calls.map((c) => c.params.id.length)).toEqual([100, 100, 30]);
    expect(users).toHaveLength(230);
    expect(users[0]).toEqual({ id: "1", login: "l1", displayName: "L1", image: "https://img/1.png" });
  });

  test("getUsers with no ids makes no request", async () => {
    const { client, calls } = setup(() => ({}));
    expect(await client.getUsers("tok", [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("getLiveFollowed maps live streams and pages through them", async () => {
    const stream = (n: number) => ({ user_id: String(n), user_login: `l${n}`, user_name: `L${n}`, game_name: "Game", title: `Title ${n}`, viewer_count: n * 10, type: "live" });
    const { client, calls } = setup((url) =>
      url.searchParams.get("after") ? { body: { data: [stream(3)], pagination: {} } } : { body: { data: [stream(1), stream(2)], pagination: { cursor: "c" } } }
    );
    const live = await client.getLiveFollowed("tok", "999");
    expect(live).toEqual([
      { id: "1", login: "l1", displayName: "L1", game: "Game", title: "Title 1", viewers: 10 },
      { id: "2", login: "l2", displayName: "L2", game: "Game", title: "Title 2", viewers: 20 },
      { id: "3", login: "l3", displayName: "L3", game: "Game", title: "Title 3", viewers: 30 },
    ]);
    expect(calls[0].path).toBe("streams/followed");
  });

  test("calls are spaced out, with no wait before the first", async () => {
    const { client, calls, sleeps } = setup(() => ({ body: { data: [], pagination: {} } }), { spacingMs: 100 });
    await client.getUsers("tok", ["1"]);
    await client.getLiveFollowed("tok", "999");
    await client.getLiveFollowed("tok", "999");
    expect(sleeps).toEqual([100, 100]);
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(100);
  });

  test("a 429 waits until the reset time from the headers, then retries", async () => {
    // reset is a Unix time in seconds: 1002s while the clock reads 1000s -> wait 2s
    const { client, sleeps, logs } = setup((_url, call) =>
      call === 1 ? { status: 429, headers: { "ratelimit-reset": "1002" }, body: { message: "Too Many Requests" } } : { body: { data: [], pagination: {} } },
      { spacingMs: 0 }
    );
    await client.getLiveFollowed("tok", "999");
    expect(sleeps).toEqual([2000]);
    expect(logs.some((l) => l.includes("429") && l.includes("streams/followed"))).toBe(true);
  });

  test("a 429 without headers backs off 1s, then 2s, and gives up after the retry limit", async () => {
    const { client, sleeps } = setup(() => ({ status: 429, body: {} }), { spacingMs: 0, maxRetries: 2 });
    const error = await client.getLiveFollowed("tok", "999").catch((e) => e);
    expect(error).toBeInstanceOf(HelixError);
    expect(error.kind).toBe("rate_limited");
    expect(sleeps).toEqual([1000, 2000]);
  });

  test("the wait for a 429 is capped", async () => {
    const { client, sleeps } = setup((_u, call) => (call === 1 ? { status: 429, headers: { "ratelimit-reset": "9999999" } } : { body: { data: [] } }), { spacingMs: 0, maxWaitMs: 5000 });
    await client.getLiveFollowed("tok", "999");
    expect(sleeps).toEqual([5000]);
  });

  test("a 401 is reported as unauthorized and is not retried", async () => {
    const { client, calls } = setup(() => ({ status: 401, body: { message: "Invalid OAuth token" } }));
    const error = await client.getFollowedChannels("tok", "999").catch((e) => e);
    expect(error).toBeInstanceOf(HelixError);
    expect(error.kind).toBe("unauthorized");
    expect(calls).toHaveLength(1);
  });

  test("other HTTP errors and network failures are reported with their kind", async () => {
    const server = setup(() => ({ status: 500, body: {} }));
    const httpError = await server.client.getLiveFollowed("tok", "999").catch((e) => e);
    expect(httpError).toMatchObject({ kind: "http", status: 500 });

    const client = createHelixClient({
      fetch: (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch,
      sleep: async () => {},
      now: () => 0,
      clientId: "c",
    });
    const networkError = await client.getLiveFollowed("tok", "999").catch((e) => e);
    expect(networkError).toMatchObject({ kind: "network" });
  });
});
