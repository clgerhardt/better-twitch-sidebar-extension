import { test, expect } from "@playwright/test";
import { startLiveRefresh } from "../src/pages/shared/liveRefresh";

// A fake document, clock and timers: the test decides what time it is and when the poll fires
const setup = (options: { visibility?: "visible" | "hidden"; fetchedAt?: number | null } = {}) => {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: options.visibility ?? "visible",
    addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
  };
  let tick: (() => void) | null = null;
  let cleared = false;
  let pollMs = 0;
  const timers = {
    setInterval: (fn: () => void, ms: number) => {
      tick = fn;
      pollMs = ms;
      return 1;
    },
    clearInterval: () => {
      cleared = true;
      tick = null;
    },
  };
  let time = 1_000_000;
  let fetchedAt: number | null = options.fetchedAt === undefined ? time : options.fetchedAt;
  let requests = 0;
  const stop = startLiveRefresh({
    intervalMs: 60_000,
    retryMs: 15_000,
    request: () => requests++,
    getFetchedAt: () => fetchedAt,
    now: () => time,
    doc,
    timers,
  });
  return {
    stop,
    requests: () => requests,
    // Time passes and the poll runs
    advance: (ms: number) => {
      time += ms;
      tick?.();
    },
    // Fresh data landed
    refreshLanded: () => (fetchedAt = time),
    switchBackToTab: () => listeners.forEach((l) => l()),
    setVisibility: (v: "visible" | "hidden") => (doc.visibilityState = v),
    listenerCount: () => listeners.size,
    cleared: () => cleared,
    pollMs: () => pollMs,
  };
};

test.describe("startLiveRefresh", () => {
  test("polls often, but only asks once the data is a minute old", () => {
    const t = setup();
    expect(t.pollMs()).toBeLessThanOrEqual(1_000);
    t.advance(30_000);
    t.advance(29_000);
    expect(t.requests()).toBe(0);
    t.advance(1_000);
    expect(t.requests()).toBe(1);
  });

  test("after fresh data lands, the next ask is a minute after that", () => {
    const t = setup();
    t.advance(60_000);
    expect(t.requests()).toBe(1);
    t.refreshLanded();
    t.advance(59_000);
    expect(t.requests()).toBe(1);
    t.advance(1_000);
    expect(t.requests()).toBe(2);
  });

  test("a refresh that fails is retried after the retry delay, not on every poll", () => {
    const t = setup();
    t.advance(60_000); // asks; fetchedAt never moves (the refresh failed)
    expect(t.requests()).toBe(1);
    t.advance(1_000);
    t.advance(13_000);
    expect(t.requests()).toBe(1);
    t.advance(1_000); // 15s since the last ask
    expect(t.requests()).toBe(2);
    t.advance(15_000);
    expect(t.requests()).toBe(3);
  });

  test("asks for nothing while the tab is hidden", () => {
    const t = setup({ visibility: "hidden" });
    t.advance(120_000);
    t.advance(120_000);
    expect(t.requests()).toBe(0);
  });

  test("asks as soon as the user switches back to the tab, but not when leaving it", () => {
    const t = setup({ visibility: "hidden" });
    t.setVisibility("visible");
    t.switchBackToTab();
    expect(t.requests()).toBe(1);
    t.setVisibility("hidden");
    t.switchBackToTab(); // the same event fires when the tab goes to the background
    expect(t.requests()).toBe(1);
  });

  test("does not ask on its own before there is any data (the first request is the caller's)", () => {
    const t = setup({ fetchedAt: null });
    t.advance(300_000);
    expect(t.requests()).toBe(0);
  });

  test("stopping removes the timer and the listener", () => {
    const t = setup();
    expect(t.listenerCount()).toBe(1);
    t.stop();
    expect(t.cleared()).toBe(true);
    expect(t.listenerCount()).toBe(0);
    t.advance(120_000);
    expect(t.requests()).toBe(0);
  });
});
