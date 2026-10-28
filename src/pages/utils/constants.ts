export const constants = {
  location: {
    CONTENT_SCRIPT: 'content_script',
    UI_COMPONENT: 'ui_component',
    BACKGROUND: 'background',
    POPUP: 'popup',
    STORAGE: 'storage',
    UTIL: 'util',
    OBSERVER: 'observer',
    NOT_SET: 'not_set',
    HOOK: 'hook'
  },
  loggerLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  },
  storage: {
    generalKey: 'bttvSidebar',
    prefix: 'bttvSidebar_',
    globalState: 'globalState',
    followedChannels: 'followedChannels',
    channelGroups: 'channelGroups',
    groupNames: 'groupNames',
    defaultGroup: 'defaultGroup',
    groupColors: 'groupColors'
  }
};

// constants.js
export const STORAGE_PREFIX = constants.storage.prefix;
export const GLOBAL_STATE_KEY = constants.storage.globalState;
// Older versions stored a derived group list here; it is only ever removed now (on logout and update)
export const FOLLOWED_CHANNELS_KEY = constants.storage.followedChannels;
// Everything older versions stored that nothing uses now; removed whenever the background starts
export const LEGACY_STORAGE_KEYS = [FOLLOWED_CHANNELS_KEY, 'sideBarStateByTab', STORAGE_PREFIX + 'sideBarStateByTab'];
export const CHANNEL_GROUPS_KEY = constants.storage.channelGroups;
export const GROUP_NAMES_KEY = constants.storage.groupNames;
export const DEFAULT_GROUP_KEY = constants.storage.defaultGroup;
export const GROUP_COLORS_KEY = constants.storage.groupColors;
// When the stored Twitch token stops working (ms since epoch), from Twitch's own validate call
export const TOKEN_EXPIRES_AT_KEY = 'tokenExpiresAt';
// The Twitch account signed in on twitch.tv, as seen by the content script: { status, id?, login?, seenAt }
export const PAGE_ACCOUNT_KEY = 'pageAccount';
// True after an explicit logout: stops silent re-login until the user connects again
export const TWITCH_LOGGED_OUT_KEY = 'twitchLoggedOut';
// The channels fetched from Twitch for the connected user (written only by the background)
export const CHANNEL_SNAPSHOT_KEY = 'channelSnapshot';

// The language Twitch was last seen in (a Twitch page's <html lang>), so the popup can follow it
export const TWITCH_LANGUAGE_KEY = 'twitchLanguage';

// What this device last synced of the groups (the common starting point for merging), and its id in the sync data
export const GROUPS_SYNC_STATE_KEY = 'groupsSyncState';
export const SYNC_DEVICE_ID_KEY = 'syncDeviceId';
// Set while the user has group syncing switched off: turning it on again adopts the synced groups
export const GROUPS_SYNC_PAUSED_KEY = 'groupsSyncPaused';
// The Twitch account the first groups sync has finished for on this device (the sidebar waits for it after a login)
export const GROUPS_SYNC_READY_KEY = 'groupsSyncReady';

// Channels the user just followed that Twitch's followed list does not include yet
export const PENDING_FOLLOWS_KEY = 'pendingFollows';
// Why the last refresh failed ('unauthorized' | 'rate_limited' | 'failed'); absent when it succeeded
export const SNAPSHOT_ERROR_KEY = 'snapshotError';
// The last Twitch channel row captured from the page, blanked of any account data, used to build
// rows when the page has none of its own
export const ROW_TEMPLATE_KEY = 'rowTemplate';
