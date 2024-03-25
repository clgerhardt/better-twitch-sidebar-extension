export const constants = {
  location: {
    CONTENT_SCRIPT: 'content_script',
    BACKGROUND: 'background',
    POPUP: 'popup',
    STORAGE: 'storage',
    NOT_SET: 'not_set'
  },
  loggerLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  },
  storage: {
    prefix: 'bttvSidebar_',
    localStorageKey: 'betterTwitchSidebar'
  },
  htmlSearchStrings: {
    ARIA_LABEL_RECOMMENDED_CHANNELS: '[aria-label="Recommended Channels"]'
  },
  portMessages: {
    FOLLOWED_CHANNELS_LOADED: 'SYS:Followers:FOLLOWED_CHANNELS_LOADED'
  }
};