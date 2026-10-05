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
export const FOLLOWED_CHANNELS_KEY = constants.storage.followedChannels;
export const CHANNEL_GROUPS_KEY = constants.storage.channelGroups;
export const GROUP_NAMES_KEY = constants.storage.groupNames;
