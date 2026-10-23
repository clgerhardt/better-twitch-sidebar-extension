// When the sidebar should say "Syncing your groups..." instead of showing groups. Pure, so it is tested in
// plain node.
//
// After a login the device has no groups of its own yet; showing them before the first sync has pulled
// the synced ones would flash the default layout and look like the groups were reset.

// Longest the sidebar waits for that first sync (offline, a slow network, a sync that cannot finish): after
// this it shows what the device has
export const SYNC_WAIT_MAX_MS = 6_000;

export const isWaitingForGroupsSync = (input: {
  // The connected Twitch account, if any
  userId: string | undefined;
  // False when the user switched syncing off
  syncOn: boolean;
  // The account the first sync has finished for on this device
  readyFor: string | undefined;
  // How long the sidebar has been waiting
  waitedMs: number;
}): boolean => !!input.userId && input.syncOn && input.readyFor !== input.userId && input.waitedMs < SYNC_WAIT_MAX_MS;
