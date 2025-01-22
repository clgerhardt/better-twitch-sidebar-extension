export const constants = {
  location: {
    CONTENT_SCRIPT: 'content_script',
    UI_COMPONENT: 'ui_component',
    BACKGROUND: 'background',
    POPUP: 'popup',
    STORAGE: 'storage',
    UTIL: 'util',
    NOT_SET: 'not_set'
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
    localStorageKey: 'betterTwitchSidebar',
    sideBarStateByTab: 'sideBarStateByTab',
    globalState: 'globalState',
    followedChannels: 'followedChannels',
    channelGroupMap: 'channelGroupMap'
  },
  htmlSearchStrings: {
    ARIA_LABEL_RECOMMENDED_CHANNELS: '[aria-label="Recommended Channels"]'
  },
  portMessages: {
    FOLLOWED_CHANNELS_LOADED: 'SYS:Followers:FOLLOWED_CHANNELS_LOADED'
  }
};

// constants.js
export const STORAGE_PREFIX = constants.storage.prefix;
export const GLOBAL_STATE_KEY = constants.storage.globalState;
export const SIDEBAR_STATE_KEY = STORAGE_PREFIX + constants.storage.sideBarStateByTab;
export const CHANNEL_GROUP_MAP = STORAGE_PREFIX + constants.storage.channelGroupMap;
export const LOCAL_STORAGE_KEY = constants.storage.localStorageKey;
