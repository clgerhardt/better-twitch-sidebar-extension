import { LIVE_REFRESH_MS } from "@src/pages/shared/liveRefresh";

// A thin line that fills over the refresh interval and starts over when fresh data arrives. It shows
// how old the stored data is, so if refreshes keep failing it stays full. Pure CSS: the animation
// starts part-way through (a negative delay) when the data is already some seconds old.
const RefreshProgress = ({ fetchedAt }: { fetchedAt: number | null }) => {
  if (fetchedAt === null) return null;
  const elapsedMs = Math.max(0, Date.now() - fetchedAt);

  return (
    <div data-testid="refresh-progress" aria-hidden="true" className="h-[3px] w-full overflow-hidden rounded bg-purple-500/20">
      <div
        key={fetchedAt}
        className="h-full bg-purple-500"
        style={{
          width: 0,
          animation: `btss-refresh-fill ${LIVE_REFRESH_MS}ms linear forwards`,
          animationDelay: `-${elapsedMs}ms`,
        }}
      />
    </div>
  );
};

export default RefreshProgress;
