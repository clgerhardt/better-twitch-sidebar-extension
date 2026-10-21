import { createGroupsSync, type SyncBase } from "../shared/groupsSync/groupsSync";
import { SYNC_PREFIX } from "../shared/groupsSync/remoteFormat";
import type { RawGroups } from "../shared/groupsSync/groupsState";
import {
  CHANNEL_GROUPS_KEY,
  DEFAULT_GROUP_KEY,
  GLOBAL_STATE_KEY,
  GROUPS_SYNC_STATE_KEY,
  GROUP_COLORS_KEY,
  GROUP_NAMES_KEY,
  SYNC_DEVICE_ID_KEY,
  constants,
} from "../utils/constants";
import { messageLogger } from "../utils/logger";

// Mirrors the groups in chrome.storage.local to chrome.storage.sync (see shared/groupsSync). Runs in the
// background, the one place that is always listening for storage changes.

const GROUP_KEYS = [GROUP_NAMES_KEY, DEFAULT_GROUP_KEY, GROUP_COLORS_KEY, CHANNEL_GROUPS_KEY];
// Edits come in bursts (ticking several channels); wait for them to settle before writing to sync, which
// limits writes to 120 a minute
const DEBOUNCE_MS = 2_000;

const deviceId = async (): Promise<string> => {
  const stored = (await chrome.storage.local.get(SYNC_DEVICE_ID_KEY))[SYNC_DEVICE_ID_KEY];
  if (typeof stored === "string") return stored;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [SYNC_DEVICE_ID_KEY]: id });
  return id;
};

export const startGroupsSync = () => {
  const sync = createGroupsSync({
    remote: {
      get: (keys) => chrome.storage.sync.get(keys),
      set: (items) => chrome.storage.sync.set(items),
      remove: (keys) => chrome.storage.sync.remove(keys),
    },
    userId: async () => (await chrome.storage.local.get("twitchUserId")).twitchUserId,
    // On unless the user switched it off in the popup
    enabled: async () => (await chrome.storage.local.get(GLOBAL_STATE_KEY))[GLOBAL_STATE_KEY]?.syncGroups !== false,
    readLocal: async (): Promise<RawGroups> => {
      const stored: Record<string, any> = await chrome.storage.local.get(GROUP_KEYS);
      return stored;
    },
    writeLocal: (state) =>
      chrome.storage.local.set({
        [GROUP_NAMES_KEY]: state.groupNames,
        [DEFAULT_GROUP_KEY]: state.defaultGroup,
        [GROUP_COLORS_KEY]: state.groupColors,
        [CHANNEL_GROUPS_KEY]: state.channelGroups,
      }),
    readBase: async () => ((await chrome.storage.local.get(GROUPS_SYNC_STATE_KEY))[GROUPS_SYNC_STATE_KEY] as SyncBase | undefined) ?? null,
    writeBase: (base) => chrome.storage.local.set({ [GROUPS_SYNC_STATE_KEY]: base }),
    deviceId,
    log: (message, detail) => messageLogger(constants.location.BACKGROUND, message, detail),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      sync.run().then(
        (result) => messageLogger(constants.location.BACKGROUND, "groups sync", result),
        (error) => messageLogger(constants.location.BACKGROUND, "groups sync failed", error)
      );
    }, DEBOUNCE_MS);
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      // The groups changed, an account connected or left, or the switch was turned on or off
      if (GROUP_KEYS.some((key) => changes[key]) || changes.twitchUserId || changes[GLOBAL_STATE_KEY]) schedule();
    } else if (area === "sync" && Object.keys(changes).some((key) => key.startsWith(SYNC_PREFIX))) {
      schedule(); // another device wrote
    }
  });

  // On every start of the worker too, which also catches changes that arrived while it was asleep
  schedule();
};
