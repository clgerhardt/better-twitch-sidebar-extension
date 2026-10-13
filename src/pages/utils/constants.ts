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
    sideBarStateByTab: 'sideBarStateByTab',
    globalState: 'globalState',
    followedChannels: 'followedChannels',
    channelGroups: 'channelGroups',
    groupNames: 'groupNames'
  },
  htmlSearchStrings: {
    ARIA_LABEL_RECOMMENDED_CHANNELS: '[aria-label="Live Channels"]'
  },
  portMessages: {
    FOLLOWED_CHANNELS_LOADED: 'SYS:Followers:FOLLOWED_CHANNELS_LOADED'
  }
};

// constants.js
export const STORAGE_PREFIX = constants.storage.prefix;
export const GLOBAL_STATE_KEY = constants.storage.globalState;
export const SIDEBAR_STATE_KEY = STORAGE_PREFIX + constants.storage.sideBarStateByTab;
// Older versions stored a derived group list here; it is only ever removed now (on logout and update)
export const FOLLOWED_CHANNELS_KEY = constants.storage.followedChannels;
export const CHANNEL_GROUPS_KEY = constants.storage.channelGroups;
export const GROUP_NAMES_KEY = constants.storage.groupNames;
// When the stored Twitch token stops working (ms since epoch), from Twitch's own validate call
export const TOKEN_EXPIRES_AT_KEY = 'tokenExpiresAt';
// The Twitch account signed in on twitch.tv, as seen by the content script: { status, id?, login?, seenAt }
export const PAGE_ACCOUNT_KEY = 'pageAccount';
// True after an explicit logout: stops silent re-login until the user connects again
export const TWITCH_LOGGED_OUT_KEY = 'twitchLoggedOut';
// The channels fetched from Twitch for the connected user (written only by the background)
export const CHANNEL_SNAPSHOT_KEY = 'channelSnapshot';
// Why the last refresh failed ('unauthorized' | 'rate_limited' | 'failed'); absent when it succeeded
export const SNAPSHOT_ERROR_KEY = 'snapshotError';
// The last Twitch channel row captured from the page, blanked of any account data, used to build
// rows when the page has none of its own
export const ROW_TEMPLATE_KEY = 'rowTemplate';
