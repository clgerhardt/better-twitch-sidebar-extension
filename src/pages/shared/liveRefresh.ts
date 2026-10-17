// Keeps live data fresh while someone is looking at the tab: asks for a refresh once the stored data
// is intervalMs old (retrying every retryMs if that does not produce new data), and again as soon as
// the user switches back to the tab. Nothing is requested while the tab is hidden.
// Scheduling by the age of the data, not by a fixed timer, is what lets a progress bar show the real
// time until the next refresh. The document, clock and timers are injectable so this is tested in
// plain node.
// Shared by the scheduler and the progress bar, so the bar always shows the real schedule:
// refresh once the stored data is this old, and retry this often if that does not produce new data
export const LIVE_REFRESH_MS = 60_000;
export const LIVE_RETRY_MS = 15_000;

type Timers = {
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (id: any) => void;
};

type LiveRefreshOptions = {
  intervalMs: number;
  // How long to wait before asking again when the data has not changed since the last ask
  retryMs: number;
  request: () => void;
  // When the stored data was last refreshed (null while there is none yet)
  getFetchedAt: () => number | null;
  // True while a connected account is waiting for its first snapshot. The request that should have
  // produced it can be lost (the background asleep, a refresh that wrote nothing), so ask again every
  // retryMs rather than leave the sidebar loading forever.
  isWaitingForFirst?: () => boolean;
  now?: () => number;
  pollMs?: number;
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  timers?: Timers;
};

// Wrappers, not the bare functions: browsers throw "Illegal invocation" if setInterval is called
// as a method of any object other than window
const browserTimers: Timers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (id) => clearInterval(id),
};

export const startLiveRefresh = ({
  intervalMs,
  retryMs,
  request,
  getFetchedAt,
  isWaitingForFirst = () => false,
  now = () => Date.now(),
  pollMs = 1_000,
  doc = document,
  timers = browserTimers,
}: LiveRefreshOptions) => {
  // The caller makes the first request itself when it starts
  let lastAskedAt = now();

  const ask = () => {
    lastAskedAt = now();
    request();
  };

  const poll = () => {
    if (doc.visibilityState !== "visible") return;
    const fetchedAt = getFetchedAt();
    if (fetchedAt === null) {
      // Nothing to age yet: the first request is the caller's, and is only repeated if it never produced a snapshot
      if (isWaitingForFirst() && now() - lastAskedAt >= retryMs) ask();
      return;
    }
    if (now() - fetchedAt >= intervalMs && now() - lastAskedAt >= retryMs) ask();
  };

  // Fires when the tab is shown and when it is hidden; the visibility check keeps only the former
  const onVisibilityChange = () => {
    if (doc.visibilityState === "visible") ask();
  };

  const interval = timers.setInterval(poll, pollMs);
  doc.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    timers.clearInterval(interval);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
  };
};
